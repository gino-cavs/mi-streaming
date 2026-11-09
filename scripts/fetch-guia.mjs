// 📺 Grilla de los canales de streaming (laguiadelstreaming.com): canal, logo, usuario de YouTube y la
// programación semanal (día, hora de inicio y de fin, programa y panelistas). Su robots.txt permite leer
// la página (no usamos /api/). Se lee una vez por día (para cuidar los límites).
// Uso: node scripts/fetch-guia.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
let prev = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/guia.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
if (prev?.canales?.length && Date.now() - Date.parse(prev.updated) < 24 * 3600e3) { await writeFile(dir + '/guia.json', JSON.stringify(prev)); console.log('Guía: reuso la de', prev.updated); process.exit(0); }
let html = '';
try { const r = await fetch('https://laguiadelstreaming.com/', { headers:{ 'User-Agent':'Mozilla/5.0 (compatible; FUNVS-guia/1.0; uso personal)' } }); if (r.ok) html = await r.text(); } catch {}
// los datos vienen dentro de la página, en los bloques self.__next_f.push([1,"…"])
let flight = '';
for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) { try { flight += JSON.parse(m[1]); } catch {} }
function objAt(s, i) {   // el objeto JSON completo que empieza en i
  let d = 0, inStr = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (c === '\\') j++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') d++; else if (c === '}') { d--; if (!d) return s.slice(i, j + 1); }
  }
  return null;
}
const byId = new Map();
for (const m of flight.matchAll(/\{"channel":\{"id":/g)) {
  const raw = objAt(flight, m.index); if (!raw) continue;
  let o; try { o = JSON.parse(raw); } catch { continue; }
  const c = o.channel; if (!c?.id || !Array.isArray(o.schedules)) continue;
  const cur = byId.get(c.id) || { id:c.id, n:c.name, logo:c.logo_url || '', h:(c.handle || '').replace(/^@/, ''), cats:(c.categories || []).map(x => x.name), sch:new Map() };
  for (const s of o.schedules) {
    if (!s.program?.name || !s.day_of_week || !s.start_time) continue;
    cur.sch.set(s.id, [s.day_of_week.slice(0, 3), s.start_time.slice(0, 5), (s.end_time || '').slice(0, 5), s.program.name, (s.program.panelists || []).map(p => p.name).slice(0, 6)]);
  }
  byId.set(c.id, cur);
}
const canales = [...byId.values()].map(c => ({ ...c, sch:[...c.sch.values()] })).filter(c => c.n);
if (!canales.length) { console.log('Guía: no pude leer la grilla (¿cambió la página?)'); if (prev) await writeFile(dir + '/guia.json', JSON.stringify(prev)); process.exit(0); }
await writeFile(dir + '/guia.json', JSON.stringify({ updated:new Date().toISOString(), fuente:'laguiadelstreaming.com', canales }));
console.log(`Guía: ${canales.length} canales, ${canales.reduce((n, c) => n + c.sch.length, 0)} programas en la semana · ej: ${canales.slice(0, 3).map(c => `${c.n} (@${c.h}, ${c.sch.length})`).join(', ')}`);
