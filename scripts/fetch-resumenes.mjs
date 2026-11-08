// Resúmenes automáticos: cuando termina un partido de tus equipos, una carrera de F1 o una velada de
// Boxeo de Primera, busca el video resumen en YouTube (con tu clave, leída del Gist privado).
// Reintenta pocas veces (1, 2, 4, 8 y 16 horas después) para cuidar la cuota de YouTube.
// Uso: node scripts/fetch-resumenes.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb, norm } from './gist.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const raw = f => `https://raw.githubusercontent.com/${repo}/datos/${f}?t=${Date.now()}`;
const getJ = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };

const prev = (await getJ(raw('resumenes.json'))) || { items:[] };
const items = new Map(prev.items.map(x => [x.k, x]));
const done = () => writeFile(dir + '/resumenes.json', JSON.stringify({ updated:new Date().toISOString(), items:[...items.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 40) }));
const db = await readDb();
if (!db || !db.key) { console.log('Resúmenes: falta el secreto GIST_ID (o la clave de YouTube en FUNVS); dejo lo que había.'); await done(); process.exit(0); }

let searches = 0;
async function yt(q, extra = {}) {
  if (searches >= 12) return [];      // tope por corrida: ~1200 unidades de cuota como mucho
  searches++;
  const p = new URLSearchParams({ part:'snippet', type:'video', maxResults:'10', q, key:db.key, regionCode:'AR', relevanceLanguage:'es', ...extra });
  const j = await getJ('https://www.googleapis.com/youtube/v3/search?' + p);
  return (j?.items || []).map(x => ({ id:x.id.videoId, t:x.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), ch:x.snippet.channelTitle, at:x.snippet.publishedAt }));
}
const TRIES = [1, 2, 4, 8, 16];   // horas después del final
const due = it => !it.video && (it.tries || 0) < TRIES.length && Date.now() - Date.parse(it.end) >= TRIES[it.tries || 0] * 3600e3;
const words = s => norm(s).split(' ').filter(w => w.length >= 4 && !/^(club|atletico|deportivo|sarsfield|juniors|plate|union|sporting|racing)$/.test(w) || /^(river|boca|velez|racing|union)$/.test(w));

/* ---------- fútbol: tus equipos ---------- */
const BAD = /en vivo|reacci|previa|conferencia|vestuario|hinchas|partidario|minuto a minuto|\blive\b|relato/i;
const GOOD = /resumen|goles|highlights|compacto|todos los goles/i;
const TRUST = /espn|tnt sports|tyc|liga profesional|fox sports|disney|conmebol|dsports|telefe/i;
for (const team of db.futbol?.teams || []) {
  let found = null, flg = 'arg.1';
  for (const lg of db.futbol?.leagues || ['arg.1']) {
    const t = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams`);
    const x = (t?.sports?.[0]?.leagues?.[0]?.teams || []).map(y => y.team).find(y => norm(y.displayName).includes(norm(team)) || norm(team).includes(norm(y.displayName)));
    if (x) { found = x; flg = lg; break; }
  }
  if (!found) { console.log('Resúmenes: no encontré', team, 'en ESPN'); continue; }
  const sc = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${flg}/teams/${found.id}/schedule`);
  for (const ev of sc?.events || []) {
    const c = ev.competitions?.[0]; if (!c || !c.status?.type?.completed) continue;
    const end = new Date(Date.parse(ev.date) + 2 * 3600e3).toISOString();
    if (Date.now() - Date.parse(end) > 3 * 864e5) continue;
    const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
    const sc2 = x => x.score?.displayValue ?? x.score ?? '';
    const k = 'f:' + ev.id;
    const it = items.get(k) || { k, tipo:'futbol', team, date:ev.date, end, title:`${H.team.shortDisplayName} ${sc2(H)}-${sc2(A)} ${A.team.shortDisplayName}`, sub:c.altDescription || ev.season?.displayName || '' };
    items.set(k, it);
    if (!due(it)) continue;
    it.tries = (it.tries || 0) + 1;
    const wh = words(H.team.displayName), wa = words(A.team.displayName);
    const res = await yt(`${H.team.shortDisplayName} ${A.team.shortDisplayName} resumen goles`, { publishedAfter:new Date(Date.parse(ev.date)).toISOString() });
    const ok = res.filter(v => { const t = norm(v.t); return GOOD.test(v.t) && !BAD.test(v.t) && wh.some(w => t.includes(w)) && wa.some(w => t.includes(w)); })
      .sort((a, b) => (TRUST.test(b.ch) ? 1 : 0) - (TRUST.test(a.ch) ? 1 : 0));
    if (ok[0]) { it.video = ok[0]; console.log('Resumen encontrado:', it.title, '→', ok[0].ch); }
  }
}

/* ---------- F1: resumen oficial de la carrera ---------- */
const motor = await getJ(raw('motor.json'));
const last = motor?.cats?.f1?.last;
if (last?.date && Date.now() - Date.parse(last.date) < 4 * 864e5) {
  const k = 'f1:' + last.date.slice(0, 10);
  const it = items.get(k) || { k, tipo:'f1', date:last.date, end:new Date(Date.parse(last.date) + 2 * 3600e3).toISOString(), title:'F1 · ' + last.name, sub:(last.results || []).slice(0, 3).map(r => `${r.pos}° ${r.name}`).join(' · ') };
  items.set(k, it);
  if (due(it)) {
    it.tries = (it.tries || 0) + 1;
    const res = await yt('Race Highlights Grand Prix', { channelId:'UCB_qr75-ydFVKSF9Dmo6izg', publishedAfter:new Date(Date.parse(last.date)).toISOString(), order:'date' });
    const v = res.find(x => /race highlights/i.test(x.t) && !/sprint|qualifying|f2|f3|academy/i.test(x.t));
    if (v) { it.video = v; console.log('Resumen F1 encontrado:', v.t); }
  }
}

/* ---------- Boxeo de Primera: la velada más reciente ---------- */
const box = await getJ(raw('boxeo.json'));
const vel = (box?.bdp || []).filter(n => /venci[oó]|gan[oó]|derrot[oó]|noque[oó]|retuvo|se consagr|combate estelar|nocaut|por puntos/i.test(n.t) && Date.now() - Date.parse(n.d) < 3 * 864e5)
  .sort((a, b) => Date.parse(b.d) - Date.parse(a.d))[0];
if (vel) {
  const k = 'box:' + vel.id;
  const it = items.get(k) || { k, tipo:'boxeo', date:vel.d, end:vel.d, title:'Boxeo de Primera', sub:vel.t };
  items.set(k, it);
  if (due(it)) {
    it.tries = (it.tries || 0) + 1;
    const names = (vel.t.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/g) || []).filter(w => w.length > 3 && !/^(Boxeo|Primera|Casino|Club|Luna|Park|Federico|Combate)$/.test(w)).slice(0, 4);
    const res = await yt(`Boxeo de Primera ${names.join(' ')}`, { publishedAfter:new Date(Date.parse(vel.d) - 864e5).toISOString() });
    const v = res.find(x => /boxeo de primera|tyc/i.test(x.t + ' ' + x.ch) && names.filter(n => norm(x.t).includes(norm(n))).length >= 1 && !/en vivo|\blive\b/i.test(x.t));
    if (v) { it.video = v; console.log('Resumen BDP encontrado:', v.t); }
  }
}

await done();
console.log(`Resúmenes: ${items.size} eventos, ${[...items.values()].filter(x => x.video).length} con video, ${searches} búsqueda(s) en YouTube`);
