// Prueba temporal: fuentes de boxeo.
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] + '/probe'; await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const urls = {
  guia_boxeo:'https://www.futbolenvivoargentina.com/deporte/boxeo',
  guia_mma:'https://www.futbolenvivoargentina.com/deporte/mma',
  tyc_boxeo:'https://www.tycsports.com/boxeo.html',
  tyc_robots:'https://www.tycsports.com/robots.txt',
  fab:'https://www.fab.org.ar/',
  espn_boxing:'https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard'
};
const log = [];
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers:UA }); const t = await r.text(); await writeFile(`${dir}/${k}.txt`, t); log.push(`${k}\t${r.status}\t${t.length}\t${r.url}`); }
  catch (e) { log.push(`${k}\tERR\t${e.message}`); }
}
await writeFile(dir + '/_log.txt', log.join('\n')); console.log(log.join('\n'));
