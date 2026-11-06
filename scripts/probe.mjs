// Prueba temporal: baja muestras de las fuentes de automovilismo para ver su formato.
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] + '/probe'; await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const urls = {
  tc2000_cal:'https://tc2000.com.ar/carreras.php?evento=calendario',
  tc2000_pos:'https://tc2000.com.ar/estadisticas.php?accion=posiciones',
  top_cal:'https://www.toprace.com.ar/toprace/calendario.html',
  top_pos:'https://www.toprace.com.ar/toprace/campeonato-general.html',
  actc_camp:'https://actc.org.ar/tc/campeonato',
  actc_pos:'https://actc.org.ar/tc/posiciones'
};
const log = [];
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers:UA, redirect:'follow' }); const t = await r.text(); await writeFile(`${dir}/${k}.txt`, t); log.push(`${k}\t${r.status}\t${t.length}\t${r.url}\t${r.headers.get('access-control-allow-origin') || '-'}`); }
  catch (e) { log.push(`${k}\tERR\t${e.message}`); }
}
await writeFile(dir + '/_log.txt', log.join('\n')); console.log(log.join('\n'));
