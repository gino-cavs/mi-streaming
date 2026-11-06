// Prueba temporal: baja muestras de las fuentes de automovilismo para ver su formato.
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] + '/probe'; await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const urls = {
  f1_sched:'https://api.jolpi.ca/ergast/f1/current.json',
  f1_last:'https://api.jolpi.ca/ergast/f1/current/last/results.json',
  f1_stand:'https://api.jolpi.ca/ergast/f1/current/driverStandings.json',
  espn_f1:'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
  espn_nascar:'https://site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard',
  espn_nascar_cal:'https://site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard?dates=2026',
  motogp_seasons:'https://api.motogp.pulselive.com/motogp/v1/results/seasons',
  motogp_events:'https://api.motogp.pulselive.com/motogp/v1/events?seasonYear=2026',
  motogp_cal:'https://api.pulselive.motogp.com/motogp/v1/events?seasonYear=2026',
  solotc:'https://www.solotc.com.ar/',
  solotc_cal:'https://www.solotc.com.ar/calendario',
  carburando:'https://www.carburando.com/',
  carb_tc:'https://www.carburando.com/categoria/turismo-carretera',
  carb_cal:'https://www.carburando.com/calendario',
  actc:'https://www.actc.org.ar/',
  guia_auto:'https://www.futbolenvivoargentina.com/deporte/automovilismo',
  guia_moto:'https://www.futbolenvivoargentina.com/deporte/motociclismo',
  solotc_robots:'https://www.solotc.com.ar/robots.txt',
  carb_robots:'https://www.carburando.com/robots.txt'
};
const log = [];
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u, { headers:UA, redirect:'follow' }); const t = await r.text(); await writeFile(`${dir}/${k}.txt`, t); log.push(`${k}\t${r.status}\t${t.length}\t${r.url}\t${r.headers.get('access-control-allow-origin') || '-'}`); }
  catch (e) { log.push(`${k}\tERR\t${e.message}`); }
}
await writeFile(dir + '/_log.txt', log.join('\n')); console.log(log.join('\n'));
