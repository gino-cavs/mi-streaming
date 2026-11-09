// Diagnóstico temporal: ¿la búsqueda de YouTube encuentra álbumes (playlists OLAK5uy_) por género? No imprime la clave.
import { readDb } from './gist.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const db = await readDb(); const key = db?.key; await mkdir('out', { recursive:true });
if (!key) { await writeFile('out/r.txt', 'sin clave (gist ' + (db ? 'ok' : 'no leído') + ')'); process.exit(0); }
const G = ['dutch techno', 'salsa', 'progressive rock', 'Galante el Emperador', 'dubstep', 'bossa nova', 'cumbia villera', 'afrobeat', 'tango', 'hardstyle', 'jazz fusion', 'k-pop'];
let out = '';
for (const g of G) for (const q of [g + ' album', g]) {
  const u = new URL('https://www.googleapis.com/youtube/v3/search'); Object.entries({ part:'snippet', type:'playlist', maxResults:25, q, key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await (await fetch(u)).json(); if (j.error) { out += `${q}: ERROR ${j.error.message}\n`; continue; }
  const it = j.items || [], ol = it.filter(x => x.id.playlistId.startsWith('OLAK5uy_'));
  out += `\n## ${q}: ${it.length} playlists, ${ol.length} álbumes\n` + ol.slice(0, 8).map(x => `  ${x.id.playlistId} | ${x.snippet.title} | ${x.snippet.channelTitle}`).join('\n') + '\n';
}
await writeFile('out/r.txt', out);
