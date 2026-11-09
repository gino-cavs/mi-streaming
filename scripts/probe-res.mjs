import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const r = await fetch('https://www.stremiar.tv/assets/index-Cx9GePeN.js', { headers:{ 'User-Agent':'Mozilla/5.0' } });
await writeFile('out/str.js', await r.text());
