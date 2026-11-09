import { execSync } from 'node:child_process'; import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/7'); const j = await r.json();
await writeFile('out/team.json', JSON.stringify({ keys:Object.keys(j.team||{}), franchise:j.team?.franchise, venue:j.team?.venue }, null, 1));
try { execSync('node scripts/fetch-estadios.mjs out klasito7/mi-streaming arg.1,uru.1,conmebol.libertadores > out/log.txt 2>&1', { timeout:900000 }); } catch (e) { await writeFile('out/err.txt', String(e)); }
