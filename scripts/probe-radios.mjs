// Diagnóstico temporal: baja robots.txt, home y páginas de "programación" de cada radio
import { writeFile, mkdir } from 'node:fs/promises';
const R = {
  mitre:'https://radiomitre.cienradios.com/', la100:'https://la100.cienradios.com/', continental:'https://www.continental.com.ar/',
  am750:'https://www.750.am/', rivadavia:'https://www.rivadavia.com.ar/', radio10:'https://www.radio10.com.ar/', lared:'https://www.lared.am/',
  convos:'https://www.radioconvos.com.ar/', urbana:'https://urbanaplayfm.com/', vorterix:'https://www.vorterix.com/', rockpop:'https://www.rockandpop.com.ar/',
  metro:'https://www.metro951.com/', aspen:'https://www.fmaspen.com/', nacional:'https://www.radionacional.com.ar/', cadena3:'https://www.cadena3.com/',
  destape:'https://www.eldestapeweb.com/radio', futurock:'https://futurock.fm/', blender:'https://blender.com.ar/', pop:'https://www.popradio.com.ar/',
  perfil:'https://radioperfil.com/', delplata:'https://www.radiodelplata.com.ar/', mega:'https://www.mega983.com/', disney:'https://www.radiodisney.com.ar/', la990:'https://www.radio990.com.ar/'
};
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language':'es-AR,es' };
const get = async u => { try { const r = await fetch(u, { headers:UA, redirect:'follow', signal:AbortSignal.timeout(20000) }); return { st:r.status, url:r.url, t:await r.text() }; } catch (e) { return { st:'ERR ' + e.message, url:u, t:'' }; } };
await mkdir('out', { recursive:true });
const idx = [];
for (const [k, u] of Object.entries(R)) {
  const o = new URL(u).origin, rob = await get(o + '/robots.txt'), home = await get(u);
  await writeFile(`out/${k}.robots.txt`, rob.t.slice(0, 4000)); await writeFile(`out/${k}.home.html`, home.t);
  const links = [...new Set([...home.t.matchAll(/href="([^"]*(?:programaci|grilla|schedule|programas)[^"]*)"/gi)].map(m => new URL(m[1].replace(/&amp;/g, '&'), home.url).href))].slice(0, 4);
  const guesses = [o + '/programacion', o + '/programacion/'];
  for (const l of [...links, ...guesses].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5)) {
    const p = await get(l); const f = `${k}.p${idx.filter(x => x.k === k).length}.html`; await writeFile('out/' + f, p.t);
    idx.push({ k, url:l, st:p.st, final:p.url, len:p.t.length, f });
  }
  idx.push({ k, url:u, st:home.st, final:home.url, len:home.t.length, f:k + '.home.html', robots:rob.st });
}
await writeFile('out/index.json', JSON.stringify(idx, null, 1));
