// 📡 Últimos videos de tus canales de YouTube por su feed público (gratis: no usa la cuota de YouTube).
// FUNVS los usa para saber qué videos mirar al revisar los vivos, en vez de pedirle la lista a la API (1 unidad por canal).
// Uso: node scripts/fetch-ytfeeds.mjs carpeta_salida
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb } from './gist.mjs';
const dir = process.argv[2] || '.';
await mkdir(dir, { recursive:true });
const db = await readDb().catch(() => null);
const ids = [...new Set([...(db?.chans || []), ...(db?.series?.chans || [])].filter(c => c.platform === 'youtube' && c.ref?.channelId && !c.ref.video).map(c => c.ref.channelId))];
const ch = {};
const one = async cid => {
  try {
    const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + cid, { headers:{ 'User-Agent':'Mozilla/5.0 (FUNVS uso personal)' }, signal:AbortSignal.timeout(15000) });
    if (!r.ok) return;
    const x = await r.text();
    ch[cid] = [...x.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map(m => m[1]);
  } catch {}
};
for (let i = 0; i < ids.length; i += 6) await Promise.all(ids.slice(i, i + 6).map(one));
await writeFile(dir + '/ytfeeds.json', JSON.stringify({ at:new Date().toISOString(), ch }));
console.log(`Feeds de YouTube: ${Object.keys(ch).length}/${ids.length} canales`);
