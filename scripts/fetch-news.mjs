// Junta noticias de Google Noticias (RSS) según news-config.json y escribe news.json.
// Lo corre GitHub Actions cada 30 minutos. Uso: node scripts/fetch-news.mjs salida/news.json
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] || 'news.json';
const cfg = JSON.parse(await readFile(new URL('../news-config.json', import.meta.url), 'utf8'));
const LOC = 'hl=es-419&gl=AR&ceid=AR:es-419';
const urlFor = t => t.home ? `https://news.google.com/rss?${LOC}`
  : t.topic ? `https://news.google.com/rss/headlines/section/topic/${t.topic}?${LOC}`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(t.q)}&${LOC}`;

const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m)
  .trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ''; };

function parse(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => {
    const s = tag(x, 'source');
    let t = tag(x, 'title');
    if (s && t.endsWith(' - ' + s)) t = t.slice(0, -(s.length + 3));
    return { t, l:tag(x, 'link'), d:new Date(tag(x, 'pubDate') || Date.now()).toISOString(), s };
  }).filter(i => i.t && i.l);
}

const byKey = new Map();
const keyOf = i => i.t.toLowerCase().replace(/\W+/g, ' ').trim();
const cutoff = Date.now() - 4 * 864e5;
for (const t of cfg.topics) {
  try {
    const r = await fetch(urlFor(t), { headers:{ 'User-Agent':'Mozilla/5.0 (mi-streaming news bot)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const items = parse(await r.text());
    let n = 0;
    for (const i of items) {
      if (Date.parse(i.d) < cutoff) continue;
      const k = keyOf(i);
      const prev = byKey.get(k);
      if (prev) { if (!prev.tp.includes(t.id)) prev.tp.push(t.id); }
      else byKey.set(k, { ...i, tp:[t.id] });
      n++;
    }
    console.log(`${t.id}: ${n} noticias`);
  } catch (e) { console.log(`${t.id}: error ${e.message}`); }
  await new Promise(r => setTimeout(r, 400));
}

const items = [...byKey.values()].sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, 900);
await mkdir(dirname(out), { recursive:true });
await writeFile(out, JSON.stringify({ updated:new Date().toISOString(), topics:cfg.topics.map(({ id, label }) => ({ id, label })), items }));
console.log(`Total: ${items.length} noticias → ${out}`);
if (!items.length) process.exit(1);
