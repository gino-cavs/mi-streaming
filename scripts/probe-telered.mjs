// Diagnóstico temporal 2: datos de la grilla de TeleRed
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (compatible; FUNVS/1.0; uso personal)', 'Accept-Language':'es-AR,es', Referer:'https://www.telered.com.ar/buscador-grilla' };
const get = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(30000) }); return { st:r.status, t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message, t:'' }; } };
let log = '';
const h = (await get('https://www.telered.com.ar/buscador-grilla')).t;
const sel = h.match(/<select[^>]*selectday[\s\S]*?<\/select>/)?.[0] || ''; log += 'select: ' + sel.replace(/\s+/g, ' ').slice(0, 600) + '\n';
const wn = sel.match(/value="([^"]+)"/)?.[1] || '0';
for (const [a, b] of [[0, 24]]) { const r = await get(`https://www.telered.com.ar/layout/grillaTVupd.php?prti=${a}&prtf=${b}&&wn=${wn}&pack=D`); await writeFile('out/upd.html', r.t); log += `upd ${a}-${b} wn=${wn} → ${r.st} ${r.t.length}\n`; }
await writeFile('out/log.txt', log);
