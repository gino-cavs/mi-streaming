// Diagnóstico temporal 4: buscador de programas de TeleRed
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const H = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36', 'Accept-Language':'es-AR,es', Referer:'https://www.telered.com.ar/buscador-grilla', 'X-Requested-With':'XMLHttpRequest', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' };
let log = '';
for (const q of ['Simpson', 'Liga Profesional']) {
  const body = new URLSearchParams({ categorias:'0', generos:'', medio:'', desde:'0', hasta:'6', segmentohorario:'', filtrorating:'', agerate:'', timeduration:'', filtroestreno:'', filtropais:'', explicit:'true', client:'', searched:q, exactname:'', exactcountry:'', exactyear:'', generotodos:'', filtrable:'' });
  try { const r = await fetch('https://www.telered.com.ar/layout/resultados-SearchTVspeed.php', { method:'POST', headers:H, body, signal:AbortSignal.timeout(30000) }); const t = await r.text(); log += `${q} → ${r.status} ${t.length}\n`; await writeFile('out/s_' + q.replace(/\W+/g, '_') + '.html', t); } catch (e) { log += q + ' ERR ' + e.message + '\n'; }
}
await writeFile('out/log.txt', log);
