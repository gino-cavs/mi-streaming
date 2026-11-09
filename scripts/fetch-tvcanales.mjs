// 📺 Programación de canales de TV de aire, desde la web de cada canal (sus robots.txt lo permiten).
// Sale en el mismo formato que la guía de streaming: [día, inicio, fin, programa, conductores], para que la guía,
// la barra Ahora / A continuación, los avisos y el buscador la usen igual. Se lee cada 6 horas como mucho.
// ESPN, TNT Sports y DSports bloquean la lectura automática; Telefe y América no publican grilla: no están.
// Uso: node scripts/fetch-tvcanales.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (compatible; FUNVS-tv/1.0; uso personal)', 'Accept-Language':'es-AR,es' };
const get = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(30000) }); return r.ok ? await r.text() : ''; } catch { return ''; } };
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DIA = { domingo:0, lunes:1, martes:2, miercoles:3, 'miércoles':3, jueves:4, viernes:5, sabado:6, 'sábado':6 };
const hm = s => { const m = String(s).match(/(\d{1,2}):(\d{1,2})/); return m ? m[1].padStart(2, '0') + ':' + m[2].padStart(2, '0') : ''; };
const ent = s => String(s || '').replace(/&amp;/g, '&').replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

let prev = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/tvcanales.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
if (prev?.canales?.length && Date.now() - Date.parse(prev.updated) < 6 * 3600e3 && !process.env.FORCE) { await writeFile(dir + '/tvcanales.json', JSON.stringify(prev)); console.log('TV de aire: reuso la de', prev.updated); process.exit(0); }

/* El Trece: datos estructurados (schema.org BroadcastEvent) de la grilla de hoy */
async function eltrece() {
  const h = await get('https://www.eltrecetv.com.ar/grilla/'), out = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { continue; }
    for (const x of [].concat(d)) if (x['@type'] === 'BroadcastEvent') for (const e of x.subEvent || []) {
      const [y, mo, da] = (e.startDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) || []).slice(1).map(Number); if (!y) continue;
      out.push([DOW[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()], hm(e.startDate.split('T')[1]), hm(e.endDate?.split('T')[1]), ent(e.name), []]);
    }
  }
  return out;
}
/* TV Pública: la semana entera en los datos de la página de horarios */
async function tvpublica() {
  const h = await get('https://www.canal7.com.ar/horarios'), m = h.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/), out = [];
  if (!m) return out; let d; try { d = JSON.parse(m[1]); } catch { return out; }
  const page = d.props?.pageProps?.page || {};
  for (const [dia, list] of Object.entries(page)) { const n = DIA[dia.toLowerCase()]; if (n == null || !Array.isArray(list)) continue;
    for (const p of list) out.push([DOW[n], hm(p.inicio), hm(p.fin), ent(p.post_title), []]); }
  return out;
}
/* El Nueve: página de horarios (datos de Next.js); si cambia, busco cualquier lista con día + hora + título */
async function elnueve() {
  const h = await get('https://www.elnueve.com.ar/horarios'), m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/), out = [];
  if (!m) return out; let d; try { d = JSON.parse(m[1]); } catch { return out; }
  const walk = (o, day) => {
    if (Array.isArray(o)) return o.forEach(x => walk(x, day));
    if (!o || typeof o !== 'object') return;
    const dn = Object.entries(o).find(([k, v]) => typeof v === 'string' && /^(day|dia|weekday|label|name)$/i.test(k) && DIA[v.toLowerCase()] != null)?.[1];
    const dd = dn ? DIA[dn.toLowerCase()] : day;
    const t = o.title || o.label || o.name || o.program?.title || o.program?.label, s = o.start || o.startTime || o.fieldStart || o.inicio || o.hour || o.time, e = o.end || o.endTime || o.fieldEnd || o.fin;
    if (dd != null && typeof t === 'string' && s && hm(s) && !DIA[t.toLowerCase()]) out.push([DOW[dd], hm(s), hm(e || ''), ent(t), []]);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, dd);
  };
  walk(d.props?.pageProps);
  return out;
}
/* Fin = inicio del siguiente cuando falta */
function fill(sch) {
  for (const d of DOW) { const l = sch.filter(x => x[0] === d).sort((a, b) => a[1].localeCompare(b[1])); l.forEach((x, i) => { if (!x[2]) x[2] = l[i + 1]?.[1] || '00:00'; }); }
  return [...new Map(sch.filter(x => x[1] && x[3]).map(x => [x.slice(0, 4).join('|'), x])).values()];
}
const CANALES = [
  { id:'tv-eltrece', n:'El Trece', alias:['el trece', 'eltrece', 'canal 13', 'trece'], web:'https://www.eltrecetv.com.ar/grilla/', p:eltrece },
  { id:'tv-tvpublica', n:'TV Pública', alias:['tv publica', 'television publica', 'canal 7', 'tvp'], web:'https://www.canal7.com.ar/horarios', p:tvpublica },
  { id:'tv-elnueve', n:'El Nueve', alias:['el nueve', 'canal 9', 'elnueve'], web:'https://www.elnueve.com.ar/horarios', p:elnueve },
];
const canales = [];
for (const C of CANALES) {
  let sch = []; try { sch = fill(await C.p()); } catch (e) { console.log(C.n, 'error:', e.message); }
  const old = prev?.canales?.find(x => x.id === C.id);
  // El Trece publica solo el día: junto lo nuevo con los otros días que ya tenía (de la última semana)
  if (old && sch.length) { const days = new Set(sch.map(x => x[0])); sch = [...sch, ...old.sch.filter(x => !days.has(x[0]))]; }
  const { p, ...meta } = C;
  if (sch.length >= 3) canales.push({ ...meta, cats:['TV de aire'], logo:'', h:'', sch });
  else { console.log(C.n, ': no pude leer la grilla'); if (old) canales.push(old); }
}
await writeFile(dir + '/tvcanales.json', JSON.stringify({ updated:new Date().toISOString(), canales }));
console.log('TV de aire:', canales.map(c => `${c.n} ${c.sch.length}`).join(' · '));
