import { writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const get = async (u, n = 2500) => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(25000) }); const t = await r.text(); return `${r.status} ${r.headers.get('content-type')} ${t.length}\n` + t.slice(0, n); } catch (e) { return 'ERR ' + e; } };
const out = {};
for (const u of ['https://ws.smn.gob.ar/alerts/type/AL', 'https://www.smn.gob.ar/robots.txt',
  'https://www.estebanecheverria.gob.ar/feed/', 'https://www.estebanecheverria.gob.ar/robots.txt',
  'https://www.enre.gov.ar/robots.txt', 'https://www.enre.gov.ar/paginacorte/js/data_EDS.js', 'https://www.enre.gov.ar/paginacorte/tabla_cortes_edesur.html',
  'https://www.colfarma.org.ar/robots.txt', 'https://www.colfarma.org.ar/Paginas/FarmaciasDeTurno.aspx',
  'https://news.google.com/rss/search?q=%22Monte+Grande%22+when:3d&hl=es-419&gl=AR&ceid=AR:es-419',
  'https://news.google.com/rss/search?q=%22tren+Roca%22+when:1d&hl=es-419&gl=AR&ceid=AR:es-419']) out[u] = await get(u);
// GTFS trenes
try {
  execSync('curl -sL -o /tmp/t.zip https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/trenes-gtfs/trenes-gtfs.zip && mkdir -p /tmp/g && unzip -o -q /tmp/t.zip -d /tmp/g');
  out.gtfs = execSync('ls -la /tmp/g; head -5 /tmp/g/routes.txt; grep -i "monte grande" /tmp/g/stops.txt | head; head -3 /tmp/g/calendar.txt; head -3 /tmp/g/stop_times.txt; head -3 /tmp/g/trips.txt; head -3 /tmp/g/feed_info.txt 2>/dev/null').toString().slice(0, 4000);
} catch (e) { out.gtfs = 'ERR ' + e.message.slice(0, 500); }
await writeFile('out/res.json', JSON.stringify(out, null, 1));
