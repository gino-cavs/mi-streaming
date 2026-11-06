// Guía de TV de futbolenvivoargentina.com: qué canal pasa cada partido (hoy y próximos días).
// Lo corre GitHub Actions. Uso: node scripts/fetch-tv.mjs carpeta_salida   |   node scripts/fetch-tv.mjs --archivo pagina.html
import { writeFile, readFile, mkdir } from 'node:fs/promises';

const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
const txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();

export function parse(html) {
  const start = html.indexOf('tablaPrincipal');
  const body = start > 0 ? html.slice(start) : html;
  const out = [];
  let date = null, comp = '';
  for (const [, attrs, inner] of body.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
    if (/cabeceraTabla/.test(attrs)) {
      const m = txt(inner).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      continue;
    }
    if (/cabeceraCompericion/.test(attrs)) { comp = txt(inner); continue; }
    const hora = inner.match(/<td class="hora[^"]*">([\s\S]*?)<\/td>/);
    if (!hora || !date) continue;
    const team = cls => { const m = inner.match(new RegExp(`<td class="${cls}[^"]*">([\\s\\S]*?)</td>`)); if (!m) return ''; const t = m[1].match(/<span title="([^"]+)"/); return t ? txt(t[1]) : txt(m[1]); };
    const canales = inner.match(/<ul class="listaCanales">([\s\S]*?)<\/ul>/);
    const channels = canales ? [...canales[1].matchAll(/<li[^>]*title="([^"]+)"/g)].map(m => txt(m[1])) : [];
    const home = team('local'), away = team('visitante');
    if (!home || !away) continue;
    out.push({ date, time:txt(hora[1]), comp, home, away, channels });
  }
  return out;
}

if (process.argv[2] === '--archivo') {
  const list = parse(await readFile(process.argv[3], 'utf8'));
  console.log(list.length, 'partidos'); console.log(list.slice(0, 6));
} else {
  const dir = process.argv[2] || '.';
  await mkdir(dir, { recursive:true });
  const r = await fetch('https://www.futbolenvivoargentina.com/', { headers:{ 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' } });
  const matches = parse(await r.text());
  await writeFile(dir + '/tv.json', JSON.stringify({ updated:new Date().toISOString(), source:'futbolenvivoargentina.com', matches }));
  console.log(`Guía de TV: ${matches.length} partidos`);
  if (!matches.length) process.exit(1);
}
