// 📻 Grilla de radios: lee la programación de la web de cada radio, UNA vez por mes (o si falta alguna).
// Sale en el mismo formato que la guía de canales: [día, inicio, fin, programa, conductores].
// Radios con la web bloqueada a programas (Rivadavia, Aspen, Futurock…) no se leen.
// Uso: node scripts/fetch-radios.mjs carpeta_salida [usuario/repo]      (LOCAL=carpeta lee HTML guardados)
import { writeFile, mkdir, readFile } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming', LOCAL = process.env.LOCAL;
await mkdir(dir, { recursive:true });

const UA = { 'User-Agent':'Mozilla/5.0 (compatible; FUNVS-radios/1.0; uso personal, 1 vez por mes)', 'Accept-Language':'es-AR,es' };
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAYS = { domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6, dom:0, lun:1, mar:2, mie:3, jue:4, vie:5, sab:6 };
const noAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ent = s => s.replace(/&amp;/g, '&').replace(/&#8211;|&ndash;/g, '–').replace(/&#039;|&#39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ');
const strip = s => ent(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const lines = h => ent(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '\n')).split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
const hm = (h, m = 0) => `${String(+h % 24).padStart(2, '0')}:${String(+m || 0).padStart(2, '0')}`;
const tcase = s => /[a-záéíóúñ]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s¿¡"(])(\p{L})/gu, (a, b, c) => b + c.toUpperCase());
/** "Lunes a Viernes", "Sábado y Domingo", "Lun. a Vie.", "Sábados" → [1,2,3,4,5] */
function dayList(txt) {
  const t = noAcc(txt).replace(/\./g, ' '), toks = [...t.matchAll(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado|dom|lun|mar|mie|jue|vie|sab)s?\b/g)];
  if (!toks.length) return /fin(es)? de semana/.test(t) ? [6, 0] : [];
  const out = new Set();
  for (let i = 0; i < toks.length; i++) {
    const d = DAYS[toks[i][1]], nx = toks[i + 1];
    if (nx && /^\s*(a|al|hasta)\s*$/.test(t.slice(toks[i].index + toks[i][0].length, nx.index))) {
      for (let k = d; ; k = (k + 1) % 7) { out.add(k); if (k === DAYS[nx[1]]) break; } i++;
    } else out.add(d);
  }
  return [...out];
}
/** "de 08 a 11:30 hs" / "06 a 10" / "De 00:00 a 05:00" → ['08:00','11:30'] */
function range(txt) {
  const m = noAcc(txt).match(/(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(?:hs\.?)?\s*(?:a|-|–|al|hasta)\s*(\d{1,2})(?:[:.](\d{2}))?/);
  return m ? [hm(m[1], m[2]), hm(m[3], m[4])] : null;
}
const add = (out, days, s, e, name, hosts = '') => { name = tcase(strip(name)); if (!name || !s) return; const pan = hosts ? strip(hosts).replace(/^(con|conducci[oó]n:)\s*/i, '').split(/,\s*| y (?=[A-ZÁÉÍÓÚ])/).map(x => x.trim()).filter(x => x && x.length < 40).slice(0, 6) : []; for (const d of days) out.push([DOW[d], s, e || '', name, pan]); };
/** Fin = inicio del siguiente programa del mismo día (cuando la web solo da la hora de inicio) */
function fillEnds(sch) {
  for (const d of DOW) { const l = sch.filter(x => x[0] === d).sort((a, b) => a[1].localeCompare(b[1])); l.forEach((x, i) => { if (!x[2]) x[2] = l[i + 1]?.[1] || '00:00'; }); }
  return sch;
}
const jsvar = (h, name) => { const i = h.indexOf(name + '='); if (i < 0) return null; let d = 0, s = i + name.length + 1, inS = false; for (let j = s; j < h.length; j++) { const c = h[j]; if (inS) { if (c === '\\') j++; else if (c === '"') inS = false; continue; } if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (!d) return JSON.parse(h.slice(s, j + 1)); } } return null; };

// ---------- un lector por radio ----------
function cienradios(h) {   // Mitre / La 100 (Grupo Clarín): la grilla viene en los datos de la página
  const cc = jsvar(h, 'Fusion.contentCache') || {}, st = Object.values(cc['stations-data'] || {})[0]?.data, out = [];
  for (const p of st?.programs || []) (p.weekSchedule || []).forEach((slots, d) => slots.forEach(x => { if (x.from?.hour == null) return; add(out, [d], hm(x.from.hour, x.from.minute), hm(x.to.hour ?? 0, x.to.minute), p.name, p.host); }));
  return out;
}
function continental(h) {   // Lunes / Programa / De 05:00:00 a 07:00:00 / descripción
  const L = lines(h), out = []; let day = null;
  L.forEach((x, i) => { const d = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(x) ? dayList(x) : null; if (d) { day = d; return; }
    const r = /^De \d/.test(x) && range(x); if (r && day) add(out, day, r[0], r[1], L[i - 1]); });
  return out;
}
function radio10(h) {   // bloques por día con hora de inicio, conductor y programa
  const out = [], map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  for (const b of h.split('data-weekday="').slice(1)) {
    const d = map[b.slice(0, b.indexOf('"'))]; if (d == null) continue;
    const body = b.split('</ul>')[0];
    for (const li of body.split('news-article__show-schedule').slice(1)) {
      const s = li.match(/>\s*(\d{1,2}):(\d{2})/), t = li.match(/news-article__title">([\s\S]*?)<\/h2>/), who = li.match(/news-article__badge">([\s\S]*?)<\/span>/);
      if (s && t) add(out, [d], hm(s[1], s[2]), '', t[1], who?.[1] || '');
    }
  }
  return fillEnds(out);
}
function lared(h) {   // /grilla: por día, hora de inicio + programa "con ..."
  const out = [], map = { domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6 };
  for (const b of h.replace(/<!--[\s\S]*?-->/g, '').split('data-grid-day-content="').slice(1)) {
    const d = map[noAcc(b.slice(0, b.indexOf('"')))]; if (d == null) continue;
    for (const r of b.split('timeline-hour').slice(1)) {
      const s = r.match(/>\s*(\d{1,2}):(\d{2})/), t = r.match(/<b>([\s\S]*?)<\/b>([\s\S]*?)<\/div>/);
      if (s && t) add(out, [d], hm(s[1], s[2]), '', t[1], strip(t[2]));
    }
  }
  return fillEnds(out);
}
function urbana(h) {   // lista "chica" por día del plugin de grilla (la primera es la de todos los programas)
  const out = [], seen = new Set();
  for (const m of h.matchAll(/<h3 class="box_header\s*">\s*([^<]+?)\s*<\/h3>\s*<ul class="tt_items_list[^"]*">([\s\S]*?)<\/ul>/g)) {
    const d = dayList(m[1]); if (d.length !== 1 || seen.has(d[0])) continue; seen.add(d[0]);
    for (const li of m[2].split('<li').slice(1)) {
      const t = li.match(/class="event_header"\s*>([\s\S]*?)<\/span>/), s = li.match(/start-hour"\s*>([\d.:]+)/), e = li.match(/end-hour"\s*>([\d.:]+)/);
      if (t && s) add(out, d, hm(...s[1].split(/[.:]/)), e ? hm(...e[1].split(/[.:]/)) : '', t[1]);
    }
  }
  return out;
}
function vorterix(h) {   // Lunes / Programa / 08:00 - 10:00
  const L = lines(h), out = []; let day = null;
  L.forEach((x, i) => { if (/^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(x)) { day = dayList(x); return; }
    const r = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(x) && range(x); if (!r || !day) return;
    let k = i - 1; while (k > 0 && /^en vivo$/i.test(L[k])) k--; add(out, day, r[0], r[1], L[k]); });
  return out;
}
function convos(h) {   // "Lunes a Viernes 08 a 11:30 hs." / Programa / conductores
  const L = lines(h), out = [];
  L.forEach((x, i) => { const d = dayList(x), r = range(x); if (!d.length || !r || x.length > 60 || !/\d/.test(x)) return; if (L[i + 1] && !range(L[i + 1])) add(out, d, r[0], r[1], L[i + 1], L[i + 2] && !dayList(L[i + 2]).length ? L[i + 2] : ''); });
  return out;
}
function cadena3(h) {   // Programa / con Fulano / De Lunes a Viernes de 00:00 a 05:00
  const L = lines(h), out = [];
  L.forEach((x, i) => { if (!/^(de )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)/i.test(x)) return; const d = dayList(x), r = range(x.replace(/^.*?\b(de|desde)\s+(?=\d)/i, '')); if (!d.length || !r) return;
    const host = /^con\s/i.test(L[i - 1]) ? L[i - 1] : '', name = host ? L[i - 2] : L[i - 1];
    if (!/\b(Rosario|Buenos Aires|Mendoza)$/i.test(name)) add(out, d, r[0], r[1], name, host); });   // las versiones regionales pisan a la red
  return out;
}

export const RADIOS = [
  { id:'mitre', n:'Radio Mitre', dial:'AM 790', alias:['mitre'], url:'https://radiomitre.cienradios.com/programacion-mitre/', p:cienradios },
  { id:'la100', n:'La 100', dial:'FM 99.9', alias:['la 100', 'la100'], url:'https://la100.cienradios.com/programacion-la-100/', p:cienradios },
  { id:'continental', n:'Radio Continental', dial:'AM 590', alias:['continental'], url:'https://www.continental.com.ar/programacion', p:continental },
  { id:'radio10', n:'Radio 10', dial:'AM 710', alias:['radio 10', 'la 10', 'am 710', 'am710'], url:'https://www.radio10.com.ar/contenidos/programacion.html', p:radio10 },
  { id:'lared', n:'La Red', dial:'AM 910', alias:['la red', 'lared', 'am 910', 'am910'], url:'https://www.lared.am/grilla', p:lared },
  { id:'convos', n:'Radio con Vos', dial:'FM 89.9', alias:['con vos', 'convos'], url:'https://radioconvos.com.ar/programacion/', p:convos },
  { id:'urbana', n:'Urbana Play', dial:'FM 104.3', alias:['urbana'], url:'https://urbanaplayfm.com/programacion/', p:urbana },
  { id:'vorterix', n:'Vorterix', dial:'FM 103.1', alias:['vorterix'], url:'https://www.vorterix.com/programacion', p:vorterix },
  { id:'cadena3', n:'Cadena 3', dial:'AM 700', alias:['cadena 3', 'cadena3'], url:'https://www.cadena3.com/pagina/programas', p:cadena3 },
];

let prev = null;
if (!LOCAL) try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/radios.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
const MES = 30 * 86400e3, now = Date.now(), radios = [];
for (const R of RADIOS) {
  const old = prev?.radios?.find(x => x.id === R.id);
  if (!LOCAL && old?.sch?.length && now - Date.parse(old.at) < MES) { radios.push(old); continue; }   // todavía vale: no gasto nada
  let sch = [];
  try {
    const h = LOCAL ? await readFile(`${LOCAL}/${R.id}.html`, 'utf8') : await (await fetch(R.url, { headers:UA, signal:AbortSignal.timeout(25000) })).text();
    sch = R.p(h).filter(x => x[1] && /^\d\d:\d\d$/.test(x[1]));
    sch = [...new Map(sch.map(x => [x.slice(0, 3).join('|'), x])).values()];
    sch = DOW.flatMap(d => { let end = ''; return sch.filter(x => x[0] === d).sort((a, b) => a[1].localeCompare(b[1])).filter(x => { if (end && x[1] < end) return false; end = x[2] > x[1] ? x[2] : '24:00'; return true; }); });   // sin superposiciones
  } catch (e) { console.log(R.n, 'error:', e.message); }
  const { p, url, ...meta } = R;
  if (sch.length >= 5) radios.push({ ...meta, web:url, at:new Date().toISOString(), sch });
  else { console.log(R.n, ': no pude leer la grilla, dejo la anterior'); if (old) radios.push(old); }
}
await writeFile(dir + '/radios.json', JSON.stringify({ updated:new Date().toISOString(), radios }));
console.log('Radios:', radios.map(r => `${r.n} ${r.sch.length}`).join(' · '));
