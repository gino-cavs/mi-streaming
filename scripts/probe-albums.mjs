// Diagnóstico temporal: ¿la búsqueda de YouTube encuentra álbumes (playlists OLAK5uy_) por género? No imprime la clave.
import { readDb } from './gist.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const db = await readDb(); const key = db?.key; await mkdir('out', { recursive:true });
if (!key) {
  const id = (process.env.GIST_ID || '').trim(); let d = `GIST_ID: ${id ? 'presente, ' + id.length + ' caracteres, ' + (/^[0-9a-f]{20,40}$/.test(id) ? 'formato OK' : 'formato RARO (¿pegaste el link entero o con espacios?)') : 'VACÍO'}\n`;
  if (id) { const m = id.match(/[0-9a-f]{20,40}/); for (const x of [id, m?.[0]].filter((v, i, a) => v && a.indexOf(v) === i)) { const r = await fetch('https://api.github.com/gists/' + encodeURIComponent(x), { headers:{ 'User-Agent':'x' } }); const j = await r.json().catch(() => ({})); d += `probe ${x === id ? 'tal cual' : 'solo el código'}: HTTP ${r.status}, archivos: ${Object.keys(j.files || {}).join(', ') || '-'}\n`; } }
  await writeFile('out/r.txt', 'sin clave\n' + d); process.exit(0); }
const G = ['dutch techno', 'salsa', 'progressive rock', 'Galante el Emperador', 'dubstep', 'bossa nova', 'cumbia villera', 'afrobeat', 'tango', 'hardstyle', 'jazz fusion', 'k-pop'];
let out = '';
for (const g of G) for (const q of [g + ' album', g]) {
  const u = new URL('https://www.googleapis.com/youtube/v3/search'); Object.entries({ part:'snippet', type:'playlist', maxResults:25, q, key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await (await fetch(u)).json(); if (j.error) { out += `${q}: ERROR ${j.error.message}\n`; continue; }
  const it = j.items || [], ol = it.filter(x => x.id.playlistId.startsWith('OLAK5uy_'));
  out += `\n## ${q}: ${it.length} playlists, ${ol.length} álbumes\n` + ol.slice(0, 8).map(x => `  ${x.id.playlistId} | ${x.snippet.title} | ${x.snippet.channelTitle}`).join('\n') + '\n';
}
await writeFile('out/r.txt', out);
// 1794184420
