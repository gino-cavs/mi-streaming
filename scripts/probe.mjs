// Prueba temporal: baja muestras de las fuentes de automovilismo para ver su formato.
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] + '/probe'; await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const urls = {
  solotc_cal_tc:'https://www.solotc.com.ar/calendario-tc-actc/',
  solotc_horarios:'https://www.solotc.com.ar/tc-pick-up-la-plata-horarios-tv-cronograma-fecha-10-2026/',
  actc:'https://actc.org.ar/',
  actc_cal:'https://actc.org.ar/tc/calendario.html',
  actc_cal2:'https://www.actc.org.ar/tc/calendario/',
  tc2000:'https://www.tc2000.com.ar/',
  tc2000_cal:'https://www.tc2000.com.ar/calendario',
  toprace:'https://www.toprace.com.ar/',
  toprace_cal:'https://www.toprace.com.ar/calendario',
  solotc_sitemap:'https://www.solotc.com.ar/sitemap_index.xml',
  motogp_res_seasons:'https://api.motogp.pulselive.com/motogp/v1/results/seasons'
};
const log = [];
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers:UA, redirect:'follow' }); const t = await r.text(); await writeFile(`${dir}/${k}.txt`, t); log.push(`${k}\t${r.status}\t${t.length}\t${r.url}\t${r.headers.get('access-control-allow-origin') || '-'}`); }
  catch (e) { log.push(`${k}\tERR\t${e.message}`); }
}
await writeFile(dir + '/_log.txt', log.join('\n')); console.log(log.join('\n'));
