// Diagnóstico temporal 3: grilla de TeleRed (variantes)
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const H = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language':'es-AR,es', Referer:'https://www.telered.com.ar/buscador-grilla', 'X-Requested-With':'XMLHttpRequest' };
let cookie = '';
const get = async u => { try { const r = await fetch(u, { headers:{ ...H, ...(cookie ? { Cookie:cookie } : {}) }, signal:AbortSignal.timeout(30000) }); const sc = r.headers.getSetCookie?.() || []; if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; '); return { st:r.status, t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message, t:'' }; } };
let log = '';
const page = await get('https://www.telered.com.ar/buscador-grilla'); await writeFile('out/page.html', page.t);
log += `page ${page.st} ${page.t.length} chrow=${(page.t.match(/chrow/g) || []).length} cookie=${cookie ? 'sí' : 'no'}\n`;
for (const q of ['prti=0&prtf=5&&wn=0&pack=D', 'prti=0&prtf=5&wn=0&pack=D', 'prti=0&prtf=5&wn=0', 'prti=0&prtf=24&wn=0&pack=B', 'prti=18&prtf=23&wn=0&pack=D']) {
  const r = await get('https://www.telered.com.ar/layout/grillaTVupd.php?' + q); log += `${q} → ${r.st} ${r.t.length} chrow=${(r.t.match(/chrow/g) || []).length}\n`; if (r.t.length > 500) await writeFile('out/upd_' + q.replace(/\W+/g, '_') + '.html', r.t);
}
const r2 = await get('https://www.telered.com.ar/layout/grillaTV.php?wn=0'); log += `grillaTV wn=0 → ${r2.st} ${r2.t.length}\n`; await writeFile('out/grillaTV.html', r2.t);
await writeFile('out/log.txt', log);
