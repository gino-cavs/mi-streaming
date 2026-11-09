// Diagnóstico temporal: robots y estructura de mi.tv
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (compatible; FUNVS/1.0; uso personal)', 'Accept-Language':'es-AR,es' };
const get = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(20000) }); return { st:r.status, url:r.url, t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message, url:u, t:'' }; } };
let log = '';
for (const u of ['https://mi.tv/robots.txt', 'https://mi.tv/ar', 'https://mi.tv/ar/programacion', 'https://mi.tv/ar/canales']) {
  const r = await get(u); const f = u.replace(/\W+/g, '_') + '.html'; await writeFile('out/' + f, r.t); log += `${u} → ${r.st} ${r.url} ${r.t.length}\n`;
}
const home = (await get('https://mi.tv/ar/sitemap')).t; await writeFile('out/sitemap.html', home);
const links = [...new Set([...home.matchAll(/href="(\/ar\/canales\/[^"#?]+)"/g)].map(m => m[1]))];
log += `canales en la home: ${links.length} · ${links.slice(0, 15).join(' ')}\n`;
for (const l of [links.find(x => /telefe/.test(x)), links.find(x => /tyc|espn/.test(x))].filter(Boolean)) { const r = await get('https://mi.tv' + l); await writeFile('out/canal_' + l.split('/').pop() + '.html', r.t); log += `canal ${l} → ${r.st} ${r.t.length}\n`; }
const any = [...new Set([...home.matchAll(/href="([^"]+)"/g)].map(m => m[1]))]; log += 'links sitemap: ' + any.length + ' · ' + any.slice(0, 40).join(' ') + '\n';
await writeFile('out/log.txt', log);
