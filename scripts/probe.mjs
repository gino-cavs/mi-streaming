// Prueba temporal: fuentes de boxeo.
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] + '/probe'; await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const urls = {
  tyc_agenda:'https://www.tycsports.com/agenda-deportiva-hoy.html',
  tyc_bdp:'https://www.tycsports.com/boxeo-de-primera.html'
};
const log = [];
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers:UA }); const t = await r.text(); await writeFile(`${dir}/${k}.txt`, t); log.push(`${k}\t${r.status}\t${t.length}\t${r.url}`); }
  catch (e) { log.push(`${k}\tERR\t${e.message}`); }
}
await writeFile(dir + '/_log.txt', log.join('\n')); console.log(log.join('\n'));
