// Guía de TV de futbolenvivoargentina.com: qué canal pasa cada partido.
// Lo corre GitHub Actions. Uso: node scripts/fetch-tv.mjs carpeta_salida
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };
const r = await fetch('https://www.futbolenvivoargentina.com/', { headers:UA });
const html = await r.text();
await writeFile(dir + '/tv-raw.html', html);
try { await writeFile(dir + '/tv-robots.txt', await (await fetch('https://www.futbolenvivoargentina.com/robots.txt', { headers:UA })).text()); } catch {}
console.log('Guía de TV:', r.status, html.length, 'caracteres');
