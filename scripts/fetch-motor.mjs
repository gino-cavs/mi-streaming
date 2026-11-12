// Automovilismo: calendario, horarios, campeonatos, últimos resultados y canales de TV.
// F1 (Jolpica), MotoGP (API de motogp.com), NASCAR (ESPN), TC (ACTC), TC2000 y Top Race (webs oficiales),
// canales: futbolenvivoargentina.com. Lo corre GitHub Actions. Uso: node scripts/fetch-motor.mjs carpeta_salida
import { writeFile, mkdir } from 'node:fs/promises';

const dir = process.argv[2] || '.';
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const get = async u => { const r = await fetch(u, { headers:UA }); if (!r.ok) throw new Error(u + ' → ' + r.status); return r; };
const json = async u => (await get(u)).json();
const html = async u => (await get(u)).text();
const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', aacute:'á', eacute:'é', iacute:'í', oacute:'ó', uacute:'ú', ntilde:'ñ', Aacute:'Á', Eacute:'É', Iacute:'Í', Oacute:'Ó', Uacute:'Ú', Ntilde:'Ñ', deg:'°', ordm:'º', uuml:'ü', ldquo:'“', rdquo:'”' };
const dec = s => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? ENT[e.toLowerCase()] ?? m);
const txt = s => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const rows = h => [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, r]) => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, c]) => txt(c)));
const YEAR = new Date().getFullYear();
const MES = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, set:9, sept:9, oct:10, nov:11, dic:12 };
const isoDay = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const title = s => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const nameFix = s => s.includes(',') ? s.split(',').map(x => x.trim()).reverse().map(title).join(' ').replace(/\s*\(M\)/i, '') : s;

/* ---------- Guía de TV (automovilismo y motociclismo) ---------- */
async function tvGuide() {
  const out = [];
  for (const path of ['automovilismo', 'motociclismo']) {
    try {
      const h = await html('https://www.futbolenvivoargentina.com/deporte/' + path);
      const body = h.slice(Math.max(0, h.indexOf('tablaPrincipal')));
      let date = null;
      for (const [, attrs, inner] of body.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
        if (/cabeceraTabla/.test(attrs)) { const m = txt(inner).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) date = isoDay(m[3], m[2], m[1]); continue; }
        const hora = inner.match(/<td class="hora[^"]*">([\s\S]*?)<\/td>/); if (!hora || !date) continue;
        const comp = (inner.match(/<label title="([^"]+)"/) || [])[1] || '';
        const ev = txt((inner.match(/<span class="eventoUnico">([\s\S]*?)<\/span>/) || [])[1] || '');
        const ch = [...inner.matchAll(/<li[^>]*title="([^"]+)"/g)].map(m => dec(m[1]));
        out.push({ date, time:txt(hora[1]), comp:dec(comp), ev, channels:ch });
      }
    } catch (e) { console.log('guía', path, e.message); }
  }
  return out;
}
const tvFor = (guide, re) => { const g = guide.find(x => re.test(x.comp) && x.channels.length && x.date >= new Date(Date.now() - 864e5).toISOString().slice(0, 10)); return g ? g.channels : []; };

/* ---------- Fórmula 1 ---------- */
const F1S = { FirstPractice:'Libres 1', SecondPractice:'Libres 2', ThirdPractice:'Libres 3', SprintQualifying:'Clasificación Sprint', SprintShootout:'Clasificación Sprint', Sprint:'Sprint', Qualifying:'Clasificación' };
const PAIS = { Australian:'Australia', Chinese:'China', Japanese:'Japón', Bahrain:'Baréin', 'Saudi Arabian':'Arabia Saudita', Miami:'Miami', 'Emilia Romagna':'Emilia-Romaña',
  Monaco:'Mónaco', Spanish:'España', 'Barcelona-Catalunya':'Barcelona', Canadian:'Canadá', Austrian:'Austria', British:'Gran Bretaña', Belgian:'Bélgica', Hungarian:'Hungría',
  Dutch:'Países Bajos', Italian:'Italia', Azerbaijan:'Azerbaiyán', Singapore:'Singapur', 'United States':'Estados Unidos', 'Mexico City':'México', Mexican:'México',
  'São Paulo':'Brasil', Brazilian:'Brasil', 'Las Vegas':'Las Vegas', Qatar:'Qatar', 'Abu Dhabi':'Abu Dabi', Madrid:'Madrid',
  Thailand:'Tailandia', Brazil:'Brasil', Americas:'las Américas', Spain:'España', France:'Francia', Italy:'Italia', Hungary:'Hungría', Czechia:'Chequia',
  Netherlands:'Países Bajos', Germany:'Alemania', 'Great Britain':'Gran Bretaña', Aragon:'Aragón', Austria:'Austria', Catalunya:'Cataluña', Japan:'Japón',
  Indonesia:'Indonesia', Australia:'Australia', Malaysia:'Malasia', Portugal:'Portugal', Valencia:'Valencia', Argentina:'Argentina', 'San Marino':'San Marino' };
const es = k => { const key = Object.keys(PAIS).find(x => x.toLowerCase() === k.toLowerCase()); return key ? PAIS[key] : k; };
const gpName = n => 'GP de ' + es(n.replace(/ Grand Prix$/, ''));
async function f1() {
  const races = (await json('https://api.jolpi.ca/ergast/f1/current.json')).MRData.RaceTable.Races;
  const at = (d, t) => new Date(d + 'T' + (t || '12:00:00Z')).toISOString();
  const cal = races.map(r => ({ round:+r.round, name:gpName(r.raceName), place:r.Circuit.Location.locality + ', ' + r.Circuit.Location.country, date:at(r.date, r.time) }));
  const nr = races.find(r => Date.parse(at(r.date, r.time)) > Date.now() - 4 * 3600e3);
  const next = nr && { name:gpName(nr.raceName), circuit:nr.Circuit.circuitName, place:cal.find(c => c.round === +nr.round).place, round:+nr.round,
    sessions:[...Object.entries(F1S).filter(([k]) => nr[k]).map(([k, n]) => ({ name:n, start:at(nr[k].date, nr[k].time), key:k === 'Qualifying' || k === 'Sprint' })),
              { name:'Carrera', start:at(nr.date, nr.time), key:true, race:true }].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) };
  let last = null, standings = [];
  try {
    const lr = (await json('https://api.jolpi.ca/ergast/f1/current/last/results.json')).MRData.RaceTable.Races[0];
    last = { name:gpName(lr.raceName), date:at(lr.date, lr.time), results:lr.Results.map(x => ({ pos:+x.position, name:x.Driver.givenName + ' ' + x.Driver.familyName, team:x.Constructor.name, status:x.status })) };
  } catch (e) { console.log('f1 last', e.message); }
  try {
    standings = (await json('https://api.jolpi.ca/ergast/f1/current/driverStandings.json')).MRData.StandingsTable.StandingsLists[0].DriverStandings
      .map(x => ({ pos:+x.position, name:x.Driver.givenName + ' ' + x.Driver.familyName, team:x.Constructors?.[0]?.name || '', pts:+x.points }));
  } catch (e) { console.log('f1 standings', e.message); }
  return { cal, next, last, standings };
}

/* ---------- MotoGP ---------- */
const MGS = { 'Free Practice Nr. 1':'Libres 1', 'Practice':'Práctica', 'Free Practice Nr. 2':'Libres 2', 'Qualifying Nr. 1':'Q1', 'Qualifying Nr. 2':'Q2', 'Tissot Sprint':'Sprint', 'Warm Up':'Warm Up', 'Grand Prix':'Carrera' };
const mgName = n => { const m = n.match(/GRAND PRIX OF (?:THE )?(.+)$/i); return m ? 'GP de ' + es(title(m[1].trim()).replace(/ And /, ' and ')) : title(n.trim()); };
async function motogp() {
  const evs = (await json(`https://api.motogp.pulselive.com/motogp/v1/events?seasonYear=${YEAR}`)).filter(e => e.kind === 'GP');
  const cal = evs.map((e, i) => ({ round:i + 1, name:mgName(e.name), place:[e.circuit?.place || e.circuit?.name, e.country?.name].filter(Boolean).join(', '), date:new Date(e.date_end).toISOString(), done:e.status === 'FINISHED' }));
  const ne = evs.find(e => e.status !== 'FINISHED');
  const next = ne && { name:mgName(ne.name), circuit:ne.circuit?.name || '', place:cal[evs.indexOf(ne)].place, round:evs.indexOf(ne) + 1,
    sessions:(ne.broadcasts || []).filter(b => b.category?.acronym === 'MGP' && ['PRACTICE', 'QUALIFYING', 'RACE', 'WARM_UP'].includes(b.kind))
      .map(b => ({ name:MGS[b.name.trim()] || b.name.trim(), start:new Date(b.date_start.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toISOString(), end:b.date_end ? new Date(b.date_end.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toISOString() : null,
        key:b.kind === 'RACE' || b.kind === 'QUALIFYING', race:b.name.trim() === 'Grand Prix', live:!!b.is_live }))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    // 🏍️ todas las categorías (MotoGP, Moto2, Moto3…) con su nombre original, para el PDF del fin de semana
    all:Object.fromEntries(Object.entries((ne.broadcasts || []).filter(b => ['PRACTICE', 'QUALIFYING', 'RACE', 'WARM_UP'].includes(b.kind) && b.category?.acronym)
      .reduce((m, b) => { (m[b.category.acronym] = m[b.category.acronym] || []).push({ n:b.name.trim(), k:b.kind,
        s:new Date(b.date_start.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toISOString(), e:b.date_end ? new Date(b.date_end.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toISOString() : null }); return m; }, {}))
      .map(([k, l]) => [k, l.sort((a, b) => Date.parse(a.s) - Date.parse(b.s))])),
    full:ne.name || '' };
  let standings = [], last = null;
  try {
    const seasons = await json('https://api.motogp.pulselive.com/motogp/v1/results/seasons');
    const season = seasons.find(s => s.year === YEAR) || seasons.find(s => s.current);
    const fin = (await json(`https://api.motogp.pulselive.com/motogp/v1/results/events?seasonUuid=${season.id}&isFinished=true`)).filter(e => !e.test);
    const le = fin[fin.length - 1];
    const cats = await json(`https://api.motogp.pulselive.com/motogp/v1/results/categories?eventUuid=${le.id}`);
    const cat = cats.find(c => /^motogp/i.test(c.name));
    try {
      const st = await json(`https://api.motogp.pulselive.com/motogp/v1/results/standings?seasonUuid=${season.id}&categoryUuid=${cat.id}`);
      standings = (st.classification || []).map(x => ({ pos:x.position, name:x.rider?.full_name || '', team:x.team?.name || x.constructor?.name || '', pts:x.points }));
    } catch (e) { console.log('motogp standings', e.message); }
    // último GP con carrera terminada (el fin de semana en curso puede figurar sin carrera todavía)
    for (const ev of fin.slice(-3).reverse()) {
      try {
        const ss = await json(`https://api.motogp.pulselive.com/motogp/v1/results/sessions?eventUuid=${ev.id}&categoryUuid=${cat.id}`);
        const rac = ss.find(s => s.type === 'RAC'); if (!rac) continue;
        const cl = await json(`https://api.motogp.pulselive.com/motogp/v1/results/session/${rac.id}/classification?test=false`);
        const res = (cl.classification || []).slice(0, 25).map(x => ({ pos:x.position, name:x.rider?.full_name || '', team:x.team?.name || '' }));
        if (res.length) { last = { name:mgName(ev.name), date:ev.date_end, results:res }; break; }
      } catch {}
    }
  } catch (e) { console.log('motogp resultados', e.message); }
  return { cal, next, last, standings };
}

/* ---------- NASCAR (ESPN) ---------- */
async function nascar() {
  const j = await json(`https://site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard?dates=${YEAR}`);
  const evs = (j.events || []).filter(e => /cup series/i.test(e.name) || true);
  const cal = evs.map((e, i) => ({ round:i + 1, name:e.name.replace(/^NASCAR Cup Series (at )?/i, ''), place:e.circuit?.fullName || '', date:e.date, done:e.status?.type?.state === 'post' }));
  const ne = evs.find(e => e.status?.type?.state !== 'post');
  const next = ne && { name:ne.name.replace(/^NASCAR Cup Series (at )?/i, ''), circuit:ne.circuit?.fullName || '', place:'', round:evs.indexOf(ne) + 1,
    sessions:[{ name:'Carrera', start:new Date(ne.date).toISOString(), key:true, race:true }] };
  const le = [...evs].reverse().find(e => e.status?.type?.state === 'post');
  const comp = le?.competitions?.[0];
  const last = comp && { name:le.name.replace(/^NASCAR Cup Series (at )?/i, ''), date:le.date,
    results:(comp.competitors || []).sort((a, b) => a.order - b.order).slice(0, 25).map(x => ({ pos:x.order, name:x.athlete?.displayName || '', team:x.vehicle?.manufacturer || '' })) };
  let standings = [];
  try {
    const s = await json('https://site.api.espn.com/apis/v2/sports/racing/nascar-premier/standings');
    const list = s.children?.[0]?.standings?.entries || s.standings?.entries || [];
    standings = list.map(x => ({ pos:+(x.stats.find(t => t.name === 'rank')?.value || 0), name:x.athlete?.displayName || '', pts:+(x.stats.find(t => t.name === 'points' || t.name === 'championshipPts')?.value || 0) }))
      .sort((a, b) => a.pos - b.pos);
  } catch (e) { console.log('nascar standings', e.message); }
  return { cal, next, last, standings };
}

/* ---------- Turismo Carretera (ACTC) ---------- */
async function tc() {
  const h = await html('https://actc.org.ar/tc/calendario');
  const t = txt(h);
  const cal = [];
  for (const m of t.matchAll(/Fecha (\d+) — ([^|]+?) (?:lun|mar|mié|mie|jue|vie|sáb|sab|dom), (\d{1,2}) (\w+) (\d{4}) (.+?) — ([^—]+?)(?= Ver resultados| Próximamente| Faltan| Fecha \d| Fechas anteriores|$)/g)) {
    const [, n, name, d, mes, y, circuit, place] = m;
    if (cal.some(c => c.round === +n)) continue;
    cal.push({ round:+n, name:title(name.trim()), circuit:circuit.trim(), place:place.trim(), date:isoDay(y, MES[mes.toLowerCase().slice(0, 4)] || MES[mes.toLowerCase().slice(0, 3)], d) + 'T16:00:00Z', dayOnly:true });
  }
  let standings = [];
  try {
    standings = rows(await html('https://actc.org.ar/tc/campeonato')).filter(r => /^\d+$/.test(r[0]) && r[2])
      .map(r => ({ pos:+r[0], name:nameFix(r[2].replace(/\s+\d+$/, '')), num:r[1], pts:+r[4] }));
  } catch (e) { console.log('tc standings', e.message); }
  return wrapDay(cal, standings);
}
/* ---------- TC2000 ---------- */
async function tc2000() {
  const h = await html('https://tc2000.com.ar/carreras.php?evento=calendario');
  const cal = [...h.matchAll(/<span class="item-fechas">(\d+)<\/span><span class="gris">(\d\d)-(\d\d)<\/span><\/h2>\s*<h3>([^<]+)<\/h3>/g)]
    .map(([, n, d, m, place]) => ({ round:+n, name:dec(place).trim(), circuit:dec(place).trim(), place:dec(place).trim(), date:isoDay(YEAR, m, d) + 'T16:00:00Z', dayOnly:true }));
  let standings = [];
  try {
    const h2 = await html('https://tc2000.com.ar/estadisticas.php?accion=posiciones');
    const a1 = h2.indexOf('id="tabs-1"'), a2 = h2.indexOf('id="tabs-2"'); const pil = h2.slice(Math.max(a1, 0), a2 > a1 ? a2 : undefined);
    for (const [, ul] of pil.matchAll(/<ul class="puntajes">([\s\S]*?)<\/ul>/g)) {
      const pos = txt((ul.match(/class="posicion[^"]*">([\s\S]*?)<\/li>/) || [])[1] || ''), name = txt((ul.match(/class="piloto">([\s\S]*?)<\/li>/) || [])[1] || ''), pts = txt((ul.match(/class="total">([\s\S]*?)<\/li>/) || [])[1] || '');
      if (name) standings.push({ pos:parseInt(pos), name, pts:+pts });
    }
  } catch (e) { console.log('tc2000 standings', e.message); }
  return wrapDay(cal, standings);
}
/* ---------- Top Race ---------- */
async function toprace() {
  const h = await html('https://www.toprace.com.ar/toprace/calendario.html');
  const cal = [];
  const blocks = h.split(/class="day-item/).slice(1);
  for (const b of blocks) {
    const d = b.match(/<h5[^>]*>\s*(\d{1,2}) (\w+)\s*<\/h5>/), n = b.match(/FECHA (\d+)/), city = b.match(/<h2>([^<]+)<\/h2>/), circ = b.match(/circuit-name">([^<]+)</);
    if (!d || !n) continue;
    const podium = [...dec(b).matchAll(/<li><span>(\d)°<\/span>\s*<a[^>]*>([^<]+)<\/a>/g)].slice(0, 3).map(m => nameFix(m[2]));
    cal.push({ round:+n[1], name:city ? title(dec(city[1]).trim()) : 'Fecha ' + n[1], circuit:circ ? dec(circ[1]).trim() : '', place:city ? dec(city[1]).trim() : '',
      date:isoDay(YEAR, MES[d[2].toLowerCase().slice(0, 3)] || 1, d[1]) + 'T16:00:00Z', dayOnly:true, podium:podium.length === 3 ? podium : null });
  }
  let standings = [];
  try {
    standings = rows(await html('https://www.toprace.com.ar/toprace/campeonato-general.html')).filter(r => /^\d+$/.test(r[0]) && r[2])
      .map(r => ({ pos:+r[0], name:nameFix(r[2]), num:r[1], wins:+r[4] || 0, pts:+r[5] }));
  } catch (e) { console.log('toprace standings', e.message); }
  const out = wrapDay(cal, standings);
  const lastDone = [...cal].reverse().find(c => c.podium);
  if (lastDone) out.last = { name:lastDone.name, date:lastDone.date, results:lastDone.podium.map((name, i) => ({ pos:i + 1, name })) };
  return out;
}
// categorías argentinas: solo sabemos el día de carrera (los horarios cambian cada fecha)
function wrapDay(cal, standings) {
  cal.sort((a, b) => a.round - b.round);
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const nx = cal.find(c => c.date.slice(0, 10) >= today);
  return { cal, standings, last:null,
    next:nx && { name:nx.name, circuit:nx.circuit, place:nx.place, round:nx.round, dayOnly:true, sessions:[{ name:'Carrera', start:nx.date, key:true, race:true, dayOnly:true }] } };
}

/* ---------- Todo junto ---------- */
await mkdir(dir, { recursive:true });
const guide = await tvGuide();
const CATS = {
  f1:     ['Fórmula 1', f1, /f[óo]rmula 1$/i],
  motogp: ['MotoGP', motogp, /motogp/i],
  nascar: ['NASCAR', nascar, /nascar cup/i],
  tc:     ['Turismo Carretera', tc, /turismo carretera|^tc$/i],
  tc2000: ['TC2000', tc2000, /tc ?2000/i],
  toprace:['Top Race', toprace, /top ?race/i]
};
const out = { updated:new Date().toISOString(), cats:{} };
for (const [id, [name, fn, re]] of Object.entries(CATS)) {
  try { out.cats[id] = { name, ...(await fn()), tv:tvFor(guide, re) }; console.log(`${id}: ok (${out.cats[id].cal.length} fechas, ${out.cats[id].standings.length} en campeonato)`); }
  catch (e) { out.cats[id] = { name, error:e.message, cal:[], standings:[], tv:tvFor(guide, re) }; console.log(`${id}: error ${e.message}`); }
}
out.guide = guide.filter(g => g.date >= new Date(Date.now() - 864e5).toISOString().slice(0, 10)).slice(0, 80);
await writeFile(dir + '/motor.json', JSON.stringify(out));
console.log('motor.json listo');
