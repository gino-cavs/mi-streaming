// ⚔️ Mundo Clásicos.
// Catálogo (una vez por semana): rivalidades de cada país desde las categorías de Wikipedia en inglés,
// con los datos de su ficha (primer partido, total, historial, goleador, más partidos), el artículo en
// castellano si existe, los jugadores que pasaron por los dos clubes (Wikidata) y el id de cada equipo en ESPN.
// Partidos (cada corrida): clásicos de los próximos 21 días y los de los últimos 10 días, en ligas y copas.
// Uso: node scripts/fetch-clasicos.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb, norm } from './gist.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
const VER = 3;
const UA = { 'User-Agent':'FUNVS-clasicos/1.0 (https://github.com/' + repo + ')' };
await mkdir(dir, { recursive:true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJ = async (u, o = {}) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, /espn\.com/.test(u) ? o : { ...o, headers:{ ...UA, ...(o.headers || {}) } }); if (r.ok) return await r.json(); if (r.status === 404 || r.status === 400) return null; } catch {} await sleep(2000 * (i + 1)); } return null; };
const wp = p => getJ('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format:'json', formatversion:'2', maxlag:'5', ...p }));

// País (como se muestra) · bandera · nombre en las categorías de Wikipedia · ligas de ESPN
const PAISES = [
  ['Argentina', '🇦🇷', 'Argentina', ['arg.1', 'arg.2', 'arg.copa']], ['Uruguay', '🇺🇾', 'Uruguay', ['uru.1']], ['Paraguay', '🇵🇾', 'Paraguay', ['par.1']],
  ['Brasil', '🇧🇷', 'Brazil', ['bra.1', 'bra.2', 'bra.copa_do_brazil']], ['Chile', '🇨🇱', 'Chile', ['chi.1']], ['Colombia', '🇨🇴', 'Colombia', ['col.1']],
  ['Perú', '🇵🇪', 'Peru', ['per.1']], ['Ecuador', '🇪🇨', 'Ecuador', ['ecu.1']], ['Bolivia', '🇧🇴', 'Bolivia', ['bol.1']], ['Venezuela', '🇻🇪', 'Venezuela', ['ven.1']],
  ['México', '🇲🇽', 'Mexico', ['mex.1']], ['Estados Unidos', '🇺🇸', 'the United States', ['usa.1']], ['Costa Rica', '🇨🇷', 'Costa Rica', ['crc.1']],
  ['España', '🇪🇸', 'Spain', ['esp.1', 'esp.2', 'esp.copa_del_rey']], ['Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', ['eng.1', 'eng.2', 'eng.3', 'eng.fa', 'eng.league_cup']],
  ['Escocia', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Scotland', ['sco.1', 'sco.2', 'sco.tennents', 'sco.cis']], ['Italia', '🇮🇹', 'Italy', ['ita.1', 'ita.2', 'ita.coppa_italia']],
  ['Alemania', '🇩🇪', 'Germany', ['ger.1', 'ger.2', 'ger.dfb_pokal']], ['Francia', '🇫🇷', 'France', ['fra.1', 'fra.2', 'fra.coupe_de_france']],
  ['Portugal', '🇵🇹', 'Portugal', ['por.1']], ['Países Bajos', '🇳🇱', 'the Netherlands', ['ned.1']], ['Bélgica', '🇧🇪', 'Belgium', ['bel.1']],
  ['Turquía', '🇹🇷', 'Turkey', ['tur.1']], ['Grecia', '🇬🇷', 'Greece', ['gre.1']], ['Austria', '🇦🇹', 'Austria', ['aut.1']], ['Suiza', '🇨🇭', 'Switzerland', ['sui.1']],
  ['Dinamarca', '🇩🇰', 'Denmark', ['den.1']], ['Suecia', '🇸🇪', 'Sweden', ['swe.1']], ['Noruega', '🇳🇴', 'Norway', ['nor.1']], ['Irlanda', '🇮🇪', 'the Republic of Ireland', ['irl.1']],
  ['Serbia', '🇷🇸', 'Serbia', []], ['Croacia', '🇭🇷', 'Croatia', []], ['Polonia', '🇵🇱', 'Poland', []], ['Chequia', '🇨🇿', 'the Czech Republic', []],
  ['Rumania', '🇷🇴', 'Romania', []], ['Hungría', '🇭🇺', 'Hungary', []], ['Rusia', '🇷🇺', 'Russia', ['rus.1']], ['Ucrania', '🇺🇦', 'Ukraine', []],
  ['Egipto', '🇪🇬', 'Egypt', []], ['Marruecos', '🇲🇦', 'Morocco', []], ['Sudáfrica', '🇿🇦', 'South Africa', ['rsa.1']],
  ['Arabia Saudita', '🇸🇦', 'Saudi Arabia', ['ksa.1']], ['Japón', '🇯🇵', 'Japan', ['jpn.1']], ['Corea del Sur', '🇰🇷', 'South Korea', ['kor.1']], ['Australia', '🇦🇺', 'Australia', ['aus.1']]
];
const COPAS = ['conmebol.libertadores', 'conmebol.sudamericana', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'concacaf.champions', 'club.friendly'];
// los que no tienen artículo en inglés pero no se pueden perder
const SEMILLAS = [{ n:'Clásico del Oeste', a:'Club Atlético Vélez Sarsfield', b:'Ferro Carril Oeste', pais:'Argentina', es:'Clásico del Oeste' }];

const STRIP = new Set(['club', 'atletico', 'atletica', 'athletico', 'fc', 'cf', 'sc', 'ac', 'as', 'sd', 'cd', 'ca', 'afc', 'football', 'futbol', 'fútbol', 'de', 'del', 'la', 'el', 'y', 'the', 'and', 'social', 'deportivo', 'sport', 'f', 'c', 'a', 'calcio', 'association', 'soccer']);
const SYN = { inter:'internazionale', internazionale:'internazionale', bayern:'bayern', psg:'paris', marsella:'marseille', milan:'milan', atenas:'athens', amsterdam:'amsterdam', ajax:'ajax' };
const toks = s => norm(String(s).replace(/\(.*?\)/g, '')).split(' ').filter(w => w && !STRIP.has(w)).map(w => SYN[w] || w);
const cleanName = t => t.replace(/\s+(Football Club|Fútbol Club|Futebol Clube|Club de Fútbol|Calcio|Soccer Club)$/i, '').replace(/^(Fútbol Club|Football Club|Club de Fútbol|Futebol Clube|Sport Club|Associazione Calcio|Società Sportiva)\s+/i, '').replace(/\s*\((football club|soccer|football|club|[A-Za-z ]*football club)\)$/i, '').replace(/\s*\(([^)]*)\)$/, ' ($1)').replace(/\b(F\.?C\.?|A\.?F\.?C\.?|S\.?C\.?|C\.?F\.?)$/g, '').replace(/^(Club Atlético|Club Deportivo|Club Social y Deportivo|Club)\s+/i, '').trim();

/* =================== catálogo =================== */
let cat = null;
try { const p = await getJ(`https://raw.githubusercontent.com/${repo}/datos/clasicos.json?t=${Date.now()}`); if (p && p.v === VER && Date.now() - Date.parse(p.catAt) < 7 * 864e5 && p.derbies?.length) cat = p; } catch {}
const db = await readDb();
const custom = (db?.futbol?.clasicos || []).filter(x => x && x.a && x.b);
const customKey = JSON.stringify(custom);
if (cat && cat.customKey !== customKey) cat = null;   // agregaste un clásico: rearmo

function template(txt, re) {
  const m = txt.match(re); if (!m) return null;
  let i = m.index, depth = 0;
  for (let j = i; j < txt.length - 1; j++) {
    if (txt[j] === '{' && txt[j + 1] === '{') { depth++; j++; } else if (txt[j] === '}' && txt[j + 1] === '}') { depth--; j++; if (!depth) return txt.slice(i, j + 1); }
  }
  return null;
}
function params(tpl) {
  const out = {}; let depth = 0, cur = '', parts = [];
  for (let i = 2; i < tpl.length - 2; i++) {
    const two = tpl.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue; }
    if (tpl[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += tpl[i];
  }
  parts.push(cur);
  for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) out[p.slice(0, k).trim().toLowerCase()] = p.slice(k + 1).trim(); }
  return out;
}
const links = s => [...(s || '').matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1].trim());
const plain = s => (s || '').replace(/\[\[(?:File|Image|Archivo):[^\]]*\]\]/gi, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<br\s*\/?>/gi, ' · ').replace(/\{\{(?:nowrap|small|nobr)\|([^{}]*)\}\}/gi, '$1')
  .replace(/\{\{(?:fb|fbaicon|flagicon|flag|fbicon)[^{}]*\}\}/gi, '').replace(/\{\{[^{}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '').trim();
const pick = (p, ...ks) => { for (const k of ks) if (p[k] && plain(p[k])) return plain(p[k]).slice(0, 220); return undefined; };

async function buildCatalog() {
  const derbies = [], pairKey = (x, y) => [x, y].map(t => t.toLowerCase()).sort().join('|'), seenPair = new Set();
  const add = d => { const k = pairKey(d.ta, d.tb); if (seenPair.has(k)) return; seenPair.add(k); derbies.push(d); };
  const byEn = new Map(PAISES.map(p => [norm(p[2].replace(/^the /, '')), p[0]]));
  const ALIAS = { 'republic of ireland':'Irlanda', ireland:'Irlanda', 'czech republic':'Chequia', czechia:'Chequia', usa:'Estados Unidos', 'united states':'Estados Unidos', holland:'Países Bajos', korea:'Corea del Sur', 'korea republic':'Corea del Sur' };
  const paisOf = h => { const n = norm(h.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')); return byEn.get(n) || ALIAS[n] || null; };

  // 1) listas de rivalidades por continente (equipos de cada clásico, ordenados por país)
  const LISTS = ['List of association football club rivalries in Europe', 'List of association football rivalries in the United Kingdom', 'List of association football club rivalries in South America',
    'List of association football club rivalries in North America', 'List of association football club rivalries in the Americas', 'List of association football club rivalries in Asia and Oceania',
    'List of association football club rivalries in Africa', 'List of association football club rivalries in Oceania', 'List of association football club rivalries in Asia'];
  const extraArt = new Map();   // artículos sueltos que aparecen como "artículo principal"
  const LINK = /\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g;
  const queue = LISTS.map(L => [L, null]), done = new Set();
  for (const [, , en] of PAISES) queue.push([`List of association football rivalries in ${en}`, null], [`List of football rivalries in ${en}`, null]);
  while (queue.length) {
    const [L, fixed] = queue.shift(); if (done.has(L)) continue; done.add(L);
    const j = await wp({ action:'query', prop:'revisions', rvprop:'content', rvslots:'main', redirects:'1', titles:L });
    const txt = j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content; if (!txt) continue;
    const ownCountry = PAISES.find(p => L.endsWith(' in ' + p[2]));
    let pais = fixed || (ownCountry ? ownCountry[0] : null), n0 = derbies.length;
    const keep = !!pais;   // lista de un solo país: los títulos de adentro son regiones, no países
    const lines = txt.split('\n');
    let row = [];
    const flushRow = () => {   // filas de tabla: | Equipo 1 || Equipo 2 || Artículo
      if (pais && row.length >= 2) {
        const cells = row.map(c => [...c.matchAll(LINK)].map(m => m[1].trim()).filter(t => !/^(File|Image|Category):/i.test(t)));
        if (cells[0]?.length === 1 && cells[1]?.length === 1) add({ pais, ta:cells[0][0], tb:cells[1][0], art:cells[2]?.[0], n:cells[2]?.[0] ? plain('[[' + cells[2][0] + ']]') : null });
      }
      row = [];
    };
    for (const ln of lines) {
      const h = ln.match(/^(={2,5})\s*(.+?)\s*\1\s*$/);
      if (h) { flushRow(); if (keep) continue; const p = paisOf(h[2]); if (p) pais = p; else if (h[1].length <= 2 && !/united kingdom/i.test(L)) pais = null; continue; }
      const mainT = ln.match(/\{\{\s*(?:main|main article|further|see also)\s*\|([^}|]+)/i);
      if (mainT && pais && /rivalr|derb/i.test(mainT[1])) { const t = mainT[1].trim(); if (/^List/i.test(t)) queue.push([t, pais]); else extraArt.set(t, pais); continue; }
      if (/^\|-/.test(ln) || /^\|\}/.test(ln)) { flushRow(); continue; }
      if (/^\|(?!\})/.test(ln)) { row.push(...ln.slice(1).split('||')); continue; }
      if (!pais || !/^\*/.test(ln) || !/\bvs?\.?\b|\bv\b/i.test(ln)) continue;
      // viñetas: * Nombre: [[Equipo A]] vs. [[Equipo B]]
      const parts = ln.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '').split(/\s+vs?\.?\s+|\s+v\s+/i);
      if (parts.length !== 2) continue;
      const lastLink = s2 => { const m = [...s2.matchAll(LINK)].filter(x => !/^(File|Image|Category):/i.test(x[1])); return m[m.length - 1]; };
      const firstLink = s2 => [...s2.matchAll(LINK)].find(x => !/^(File|Image|Category):/i.test(x[1]));
      const A = lastLink(parts[0]), B = firstLink(parts[1]); if (!A || !B) continue;
      const head = parts[0].slice(0, A.index), colon = head.lastIndexOf(':');
      const nameTxt = colon > 0 ? head.slice(0, colon).replace(/^\*+/, '') : '';
      const art = [...nameTxt.matchAll(LINK)][0]?.[1];
      add({ pais, ta:A[1].trim(), tb:B[1].trim(), art, n:plain(nameTxt) || null });
    }
    flushRow();
    console.log(`${L}: ${derbies.length - n0} clásicos`);
    await sleep(200);
  }
  // 2) también los artículos de las categorías por país (por si alguno no está en las listas)
  const extra = new Map(extraArt);
  for (const [pais, , en] of PAISES) for (const cName of [`Association football rivalries in ${en}`, `Football rivalries in ${en}`, `Football derbies in ${en}`]) {
    const j = await wp({ action:'query', list:'categorymembers', cmtitle:'Category:' + cName, cmlimit:'500', cmtype:'page' });
    for (const m of j?.query?.categorymembers || []) if (!/^List/i.test(m.title)) extra.set(m.title, pais);
  }
  // 3) fichas de los artículos (datos del clásico) + título en castellano
  const arts = new Map(); derbies.forEach(d => { if (d.art) arts.set(d.art, d); });
  for (const [t, pais] of extra) if (!arts.has(t)) arts.set(t, { pais, art:t, extra:true });
  const titles = [...arts.keys()];
  for (let i = 0; i < titles.length; i += 40) {
    const j = await wp({ action:'query', prop:'revisions|langlinks', rvprop:'content', rvslots:'main', lllang:'es', redirects:'1', titles:titles.slice(i, i + 40).join('|') });
    const back = new Map(); for (const x of [...(j?.query?.normalized || []), ...(j?.query?.redirects || [])]) back.set(x.to, x.from);
    for (const pg of j?.query?.pages || []) {
      let t0 = pg.title; while (!arts.has(t0) && back.has(t0)) t0 = back.get(t0);
      const d = arts.get(t0); if (!d) continue;
      const txt = pg.revisions?.[0]?.slots?.main?.content || '';
      const tpl = template(txt, /\{\{\s*Infobox[^|}\n]*(rivalry|derby)/i), p = tpl ? params(tpl) : {};
      d.en = pg.title; d.es = pg.langlinks?.[0]?.title;
      d.n = pick(p, 'name') || d.n || pg.title.replace(/ rivalry$/i, '');
      d.alias = pick(p, 'other_names', 'nickname');
      d.info = { desde:pick(p, 'firstmeeting', 'first_meeting', 'first_contested'), total:pick(p, 'total', 'meetings_total', 'total_meetings'), record:pick(p, 'alltimerecord', 'all_time_record', 'series', 'record'),
        masGanados:pick(p, 'most_wins', 'mostwins'), goleador:pick(p, 'top_scorer', 'topscorer', 'most_goals'), masPartidos:pick(p, 'most_player_appearances', 'most_appearances'),
        goleada:pick(p, 'largest_victory', 'largestvictory', 'biggest_win', 'largest_win'), ultimo:pick(p, 'latest_meeting', 'latestmeeting', 'mostrecent', 'most_recent'), estadios:pick(p, 'stadiums', 'stadium'), lugar:pick(p, 'location', 'city_or_region') };
      if (d.extra) {   // solo artículo: los equipos salen de la ficha o del título
        let teams = [];
        for (const k of ['team1', 'team2']) if (p[k]) teams.push(links(p[k])[0]);
        if (teams.filter(Boolean).length < 2) teams = links(p.teams || '').filter(x => !/^(File|Image):/i.test(x));
        if (teams.length !== 2) { const m = pg.title.replace(/ (rivalry|derby|derbies)( \(.*\))?$/i, '').split(/\s*[–—]\s*|\s+vs\.?\s+/); if (m.length === 2) teams = m; }
        if (teams.length === 2 && teams[0] && teams[1]) add({ ...d, ta:teams[0], tb:teams[1] });
      }
    }
    await sleep(300);
  }
  derbies.forEach(d => { d.id = 'c' + norm(d.ta + ' ' + d.tb).replace(/ /g, '').slice(0, 40); d.info = d.info || {}; delete d.extra; delete d.art; });
  // 3) semillas y clásicos que agregaste en FUNVS
  for (const s of [...SEMILLAS, ...custom.map(c => ({ n:c.n || `${c.a} vs ${c.b}`, a:c.a, b:c.b, pais:c.pais || '⭐ Tuyos', custom:true }))]) {
    const ft = async q => (await wp({ action:'query', list:'search', srsearch:q + ' football club', srlimit:'1' }))?.query?.search?.[0]?.title;
    const ta = await ft(s.a), tb = await ft(s.b);
    if (ta && tb) { const ex = derbies.find(d => pairKey(d.ta, d.tb) === pairKey(ta, tb)); if (ex) { if (s.custom) ex.custom = true; if (s.es && !ex.es) ex.es = s.es; } else derbies.push({ id:'s' + norm(ta + tb).replace(/ /g, '').slice(0, 40), n:s.n, pais:s.pais, es:s.es, ta, tb, info:{}, custom:s.custom }); }
  }
  // 4) equipos: título real, nombre corto y Wikidata
  const tset = [...new Set(derbies.flatMap(d => [d.ta, d.tb]))], team = new Map();
  for (let i = 0; i < tset.length; i += 50) {
    const j = await wp({ action:'query', prop:'pageprops', ppprop:'wikibase_item', redirects:'1', titles:tset.slice(i, i + 50).join('|') });
    const fwd = new Map(); for (const x of [...(j?.query?.normalized || []), ...(j?.query?.redirects || [])]) fwd.set(x.from, x.to);
    const byT = new Map((j?.query?.pages || []).map(p => [p.title, p]));
    for (const t of tset.slice(i, i + 50)) { let c = t, n = 0; while (fwd.has(c) && n++ < 3) c = fwd.get(c); const p = byT.get(c); team.set(t, { t:c, q:p?.pageprops?.wikibase_item, n:cleanName(c) }); }
  }
  for (const d of derbies) { d.a = { ...team.get(d.ta) }; d.b = { ...team.get(d.tb) }; delete d.ta; delete d.tb; }
  // sacar duplicados (mismo par) y rivalidades que no son entre clubes (selecciones, ciudades, etc.)
  const seen = new Set();
  const list = derbies.filter(d => { if (!d.a.q || !d.b.q || d.a.q === d.b.q) return false; const k = [d.a.q, d.b.q].sort().join(); if (seen.has(k)) return false; seen.add(k); return true; });
  // 5) Wikidata: nombre en castellano, que sean clubes, y jugadores que pasaron por los dos
  const qs = [...new Set(list.flatMap(d => [d.a.q, d.b.q]))], lab = new Map(), isNat = new Set();
  for (let i = 0; i < qs.length; i += 200) {
    const r = await sparql(`SELECT ?t ?es ?nat WHERE { VALUES ?t { ${qs.slice(i, i + 200).map(q => 'wd:' + q).join(' ')} } OPTIONAL { ?t rdfs:label ?es FILTER(LANG(?es) = "es") } BIND(EXISTS { ?t wdt:P31 wd:Q6979593 } AS ?nat) }`);
    for (const b of r) { const q = b.t.value.split('/').pop(); if (b.es) lab.set(q, b.es.value); if (b.nat?.value === 'true') isNat.add(q); }
  }
  const out = list.filter(d => !isNat.has(d.a.q) && !isNat.has(d.b.q));
  for (const d of out) { for (const s of [d.a, d.b]) if (lab.has(s.q)) s.n = cleanName(lab.get(s.q)); if (!d.n) d.n = `${d.a.n} vs ${d.b.n}`; }
  for (let i = 0; i < out.length; i += 30) {
    const vals = out.slice(i, i + 30).map(d => `("${d.id}" wd:${d.a.q} wd:${d.b.q})`).join(' ');
    const r = await sparql(`SELECT ?d ?p ?n ?sl WHERE { VALUES (?d ?a ?b) { ${vals} } ?p wdt:P54 ?a; wdt:P54 ?b; wikibase:sitelinks ?sl.
      OPTIONAL { ?p rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") } BIND(COALESCE(?es, ?en) AS ?n) }`);
    const by = {}; for (const b of r) (by[b.d.value] = by[b.d.value] || []).push([b.n?.value, +b.sl.value]);
    for (const d of out.slice(i, i + 30)) { const ps = (by[d.id] || []).filter(x => x[0] && !/^Q\d+$/.test(x[0])).sort((a, b) => b[1] - a[1]); d.nboth = ps.length; d.both = ps.slice(0, 40).map(x => x[0]); }
    await sleep(500);
  }
  // 6) ESPN: id de cada equipo (por nombre, dentro de las ligas de su país)
  for (const [pais, , , lgs] of PAISES) {
    const espn = [];
    for (const lg of lgs) { const j = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams`); for (const x of j?.sports?.[0]?.leagues?.[0]?.teams || []) espn.push({ id:x.team.id, n:x.team.displayName, s:x.team.shortDisplayName, lg }); }
    for (const d of out.filter(d => d.pais === pais || d.custom)) for (const s of [d.a, d.b]) {
      if (s.espn) continue;
      const A = toks(s.t), A2 = toks(s.n);
      let best = null, bs = 0;
      for (const e of espn) {
        const E = toks(e.n); if (!E.length) continue;
        for (const X of [A, A2]) {
          const inter = E.filter(w => X.includes(w)).length;
          const ok = inter === E.length || inter === X.length;
          const score = ok ? inter * 10 - Math.abs(E.length - X.length) : 0;
          if (score > bs) { bs = score; best = e; }
        }
      }
      if (best) { s.espn = best.id; s.lg = best.lg; s.sc = bs; s.logo = `https://a.espncdn.com/i/teamlogos/soccer/500/${best.id}.png`; }
    }
    for (const d of out) if (d.a.espn && d.a.espn === d.b.espn) { const w = d.a.sc >= d.b.sc ? d.b : d.a; delete w.espn; delete w.logo; delete w.lg; }
  }
  const rank = d => (d.en ? 1000 : 0) + (d.nboth || 0) + (d.a.espn && d.b.espn ? 300 : 0);
  out.sort((x, y) => rank(y) - rank(x));
  console.log(`Catálogo: ${out.length} clásicos · con ESPN los dos equipos: ${out.filter(d => d.a.espn && d.b.espn).length}`);
  const byP = {}; out.forEach(d => byP[d.pais] = (byP[d.pais] || 0) + 1); console.log(JSON.stringify(byP));
  for (const k of ['Vélez', 'Celtic', 'Athletic', 'Cerro Porteño', 'Peñarol', 'Urawa', 'Sydney', 'Boca']) { const d = out.find(x => (x.a.n + x.b.n).includes(k)); console.log(' ·', k, '→', d ? `${d.n} (${d.a.n} vs ${d.b.n}) · ${d.nboth} jugaron en los dos · ESPN ${d.a.espn || '—'}/${d.b.espn || '—'} · ficha: ${JSON.stringify(d.info).slice(0, 160)}` : 'NO ESTÁ'); }
  return out;
}
async function sparql(q) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch('https://query.wikidata.org/sparql', { method:'POST', headers:{ ...UA, Accept:'application/sparql-results+json', 'Content-Type':'application/x-www-form-urlencoded' }, body:'query=' + encodeURIComponent(q) }); if (r.ok) return (await r.json()).results.bindings; console.log('SPARQL', r.status); } catch (e) { console.log('SPARQL', e.message); }
    await sleep(6000);
  }
  return [];
}
let derbies = cat?.derbies, catAt = cat?.catAt;
if (!derbies) { derbies = await buildCatalog(); catAt = new Date().toISOString(); }
else console.log('Clásicos: reuso el catálogo de', cat.catAt);

/* =================== partidos: próximos 21 días y últimos 10 =================== */
const ymd = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
const range = `${ymd(Date.now() - 10 * 864e5)}-${ymd(Date.now() + 21 * 864e5)}`;
const pair = new Map(); for (const d of derbies) if (d.a.espn && d.b.espn) pair.set([d.a.espn, d.b.espn].sort().join('-'), d.id);
const lgs = [...new Set([...PAISES.flatMap(p => p[3]), ...COPAS])];
const fixtures = new Map();
for (const lg of lgs) {
  const j = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${range}`);
  if (lg === 'eng.1' || lg === 'arg.1') console.log(`ESPN ${lg}: ${j?.events?.length ?? 'sin respuesta'} partidos en ${range}`);
  for (const ev of j?.events || []) {
    const c = ev.competitions?.[0]; if (!c) continue;
    const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away'); if (!H || !A) continue;
    const id = pair.get([H.team.id, A.team.id].sort().join('-')); if (!id) continue;
    fixtures.set(ev.id, { e:ev.id, d:id, date:ev.date, lg:j.leagues?.[0]?.name || lg, slug:lg, h:H.team.shortDisplayName || H.team.displayName, a:A.team.shortDisplayName || A.team.displayName,
      hs:H.score, as:A.score, st:ev.status?.type?.state, det:ev.status?.type?.shortDetail, venue:c.venue?.fullName });
  }
}
const fx = [...fixtures.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
await writeFile(dir + '/clasicos.json', JSON.stringify({ v:VER, paises:PAISES.map(p => [p[0], p[1]]), updated:new Date().toISOString(), catAt, customKey, derbies, fixtures:fx }));
console.log(`Clásicos: ${derbies.length} en el catálogo · ${fx.filter(f => f.st !== 'post').length} por jugarse · ${fx.filter(f => f.st === 'post').length} jugados hace poco`);
