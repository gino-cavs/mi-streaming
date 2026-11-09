// Diagnóstico temporal: robots y estructura de la grilla de TeleRed
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (compatible; FUNVS/1.0; uso personal)', 'Accept-Language':'es-AR,es' };
const get = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(25000) }); return { st:r.status, url:r.url, ct:r.headers.get('content-type'), t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message, url:u, t:'' }; } };
let log = '';
for (const u of ['https://www.telered.com.ar/robots.txt', 'https://www.telered.com.ar/buscador-grilla']) { const r = await get(u); await writeFile('out/' + u.replace(/\W+/g, '_') + '.html', r.t); log += `${u} → ${r.st} ${r.ct} ${r.t.length}\n`; }
const h = (await get('https://www.telered.com.ar/buscador-grilla')).t;
const urls = [...new Set([...h.matchAll(/(?:src|href|url|fetch\(|ajax)[=:(]\s*["']([^"']+)["']/g)].map(m => m[1]))].filter(x => /api|json|grilla|ajax|epg|program/i.test(x));
log += 'urls candidatas: ' + urls.join(' ') + '\n';
const js = [...new Set([...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]))]; log += 'scripts: ' + js.join(' ') + '\n';
for (const s of js.filter(x => !/google|gtag|facebook|jquery|bootstrap/i.test(x)).slice(0, 6)) { const r = await get(new URL(s, 'https://www.telered.com.ar/').href); const m = [...new Set([...r.t.matchAll(/["'`](\/?[\w\/\-.]*(?:api|grilla|epg|programac|ajax)[\w\/\-.?=&]*)["'`]/gi)].map(x => x[1]))]; log += `  ${s} (${r.t.length}): ${m.slice(0, 20).join(' ')}\n`; }
await writeFile('out/log.txt', log);
