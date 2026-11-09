// Diagnóstico temporal: robots y páginas de programación de canales de TV
import { writeFile, mkdir } from 'node:fs/promises';
const C = { telefe:'https://mitelefe.com/', eltrece:'https://www.eltrecetv.com.ar/', america:'https://www.americatv.com.ar/', tvpublica:'https://www.tvpublica.com.ar/', elnueve:'https://www.elnueve.com.ar/',
  espn:'https://www.espn.com.ar/', tnt:'https://www.tntsports.com.ar/', tyc:'https://www.tycsports.com/', dsports:'https://www.directvsports.com/', tn:'https://tn.com.ar/', c5n:'https://www.c5n.com/', a24:'https://www.a24.com/' };
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language':'es-AR,es' };
const get = async u => { try { const r = await fetch(u, { headers:UA, redirect:'follow', signal:AbortSignal.timeout(20000) }); return { st:r.status, url:r.url, t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message.slice(0, 40), url:u, t:'' }; } };
await mkdir('out', { recursive:true }); const idx = [];
for (const [k, u] of Object.entries(C)) {
  const o = new URL(u).origin, rob = await get(o + '/robots.txt'), home = await get(u);
  await writeFile(`out/${k}.robots.txt`, rob.t.slice(0, 5000));
  const links = [...new Set([...home.t.matchAll(/href="([^"]*(?:programaci|grilla|guia-de-tv|guia|schedule|agenda)[^"]*)"/gi)].map(m => { try { return new URL(m[1].replace(/&amp;/g, '&'), home.url).href; } catch { return null; } }).filter(Boolean))].slice(0, 4);
  const guesses = [o + '/programacion', o + '/programacion/', o + '/grilla'];
  idx.push({ k, home:home.st, robots:rob.st, homeLen:home.t.length });
  let n = 0;
  for (const l of [...links, ...guesses].filter((x, i, a) => a.indexOf(x) === i).slice(0, 6)) { const p = await get(l); const f = `${k}.p${n++}.html`; await writeFile('out/' + f, p.t); idx.push({ k, url:l, st:p.st, final:p.url, len:p.t.length, f, next:/__NEXT_DATA__/.test(p.t), ld:(p.t.match(/application\/ld\+json/g) || []).length, horas:(p.t.match(/\b\d{1,2}:\d{2}\b/g) || []).length }); }
}
await writeFile('out/index.json', JSON.stringify(idx, null, 1));
