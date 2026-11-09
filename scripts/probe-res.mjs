import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const raw = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(25000) }); return [r.status, await r.text()]; } catch (e) { return [0, 'ERR ' + e]; } };
let [s, t] = await raw('https://programacion.grupoamerica.com.ar/grilla/a24.json'); await writeFile('out/a24.json', s + '\n' + t);
[s, t] = await raw('https://programacion.grupoamerica.com.ar/robots.txt'); await writeFile('out/ga.robots', s + '\n' + t.slice(0, 2000));
[s, t] = await raw('https://www.stremiar.tv/assets/index-Cx9GePeN.js');
await writeFile('out/str.api', s + ' ' + t.length + '\n' + [...new Set(t.match(/["'`](https?:\/\/[^"'`\s]{4,120}|\/api\/[^"'`\s]{1,120})["'`]/g) || [])].join('\n') + '\n\n' + [...new Set(t.match(/.{80}cronica.{120}/gi) || [])].slice(0, 8).join('\n----\n'));
