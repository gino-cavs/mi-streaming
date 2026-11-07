// Boxeo de Primera (TyC Sports): últimas crónicas y previas, con imagen, bajada y fecha.
// Lo corre GitHub Actions. Uso: node scripts/fetch-boxeo.mjs carpeta_salida
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.';
const UA = { 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language':'es-AR,es;q=0.9' };
const BASE = 'https://www.tycsports.com';
const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
const dec = s => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const txt = s => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const meta = (h, k) => { const m = h.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)="${k}"[^>]+content="([^"]*)"`, 'i')) || h.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name|itemprop)="${k}"`, 'i')); return m ? dec(m[1]) : ''; };

const list = await (await fetch(BASE + '/boxeo-de-primera.html', { headers:UA })).text();
const seen = new Map();
for (const m of list.matchAll(/<a[^>]+href="(\/boxeo-de-primera\/[^"]+-id(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g)) {
  const t = txt(m[3]); if (!t) continue;
  if (!seen.has(m[2]) || seen.get(m[2]).t.length < t.length) seen.set(m[2], { id:+m[2], l:BASE + m[1], t });
}
const items = [...seen.values()].sort((a, b) => b.id - a.id).slice(0, 14);
for (const it of items) {         // detalle de cada nota (de a una, sin apuro)
  try {
    const h = await (await fetch(it.l, { headers:UA })).text();
    it.d = meta(h, 'article:published_time') || meta(h, 'datePublished') || (h.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || '';
    it.img = meta(h, 'og:image'); it.desc = meta(h, 'og:description') || meta(h, 'description');
  } catch {}
  await new Promise(r => setTimeout(r, 300));
}
await mkdir(dir, { recursive:true });
await writeFile(dir + '/boxeo.json', JSON.stringify({ updated:new Date().toISOString(), source:'tycsports.com', bdp:items }));
console.log(`Boxeo de Primera: ${items.length} notas`);
if (!items.length) process.exit(1);
