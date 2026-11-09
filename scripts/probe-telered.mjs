// Diagnóstico temporal 5: buscador de TeleRed con la sesión de la página
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const H = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language':'es-AR,es' };
let jar = {}; const ck = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
const take = r => (r.headers.getSetCookie?.() || []).forEach(c => { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); });
let log = '';
const p = await fetch('https://www.telered.com.ar/buscador-grilla', { headers:H }); take(p); const page = await p.text();
log += `cookies: ${Object.keys(jar).join(',')}\n`;
const form = page.match(/<form[^>]*id="searchtvform"[\s\S]*?<\/form>/)?.[0] || '';
const fields = {}; for (const m of form.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/g)) { const v = m[0].match(/value="([^"]*)"/)?.[1] ?? ''; if (/checkbox/.test(m[0]) && !/checked/.test(m[0])) continue; fields[m[1]] = v; }
for (const m of form.matchAll(/<select[^>]*name="([^"]+)"[\s\S]*?<\/select>/g)) fields[m[1]] = m[0].match(/<option[^>]*selected[^>]*value="([^"]*)"/)?.[1] ?? m[0].match(/<option[^>]*value="([^"]*)"/)?.[1] ?? '';
log += 'campos: ' + JSON.stringify(fields).slice(0, 600) + '\n';
for (const [q, extra] of [['Simpson', { byshow:'PR', bymovie:'PE' }], ['Simpson', { hasta:'6' }], ['noticias', { byshow:'PR', hasta:'6', categorias:'2' }]]) {
  const body = new URLSearchParams({ ...fields, searched:q, tvsearch:q, desde:'0', ...extra });
  const r = await fetch('https://www.telered.com.ar/layout/resultados-SearchTVspeed.php', { method:'POST', headers:{ ...H, Cookie:ck(), Referer:'https://www.telered.com.ar/buscador-grilla', 'X-Requested-With':'XMLHttpRequest', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', Origin:'https://www.telered.com.ar' }, body });
  const t = await r.text(); log += `${q} ${JSON.stringify(extra)} → ${r.status} ${t.length}\n`; await writeFile(`out/s_${q}_${Object.keys(extra).join('')}.html`, t);
}
const g = await fetch('https://www.telered.com.ar/layout/grillaTVupd.php?prti=0&prtf=5&&wn=0&pack=D', { headers:{ ...H, Cookie:ck(), Referer:'https://www.telered.com.ar/buscador-grilla', 'X-Requested-With':'XMLHttpRequest' } });
const gt = await g.text(); log += `grilla con sesión → ${g.status} ${gt.length}\n`; await writeFile('out/grilla.html', gt);
await writeFile('out/log.txt', log);
