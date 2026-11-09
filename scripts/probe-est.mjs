import { execSync } from 'node:child_process'; import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const j = await (await fetch('https://sports.core.api.espn.com/v2/sports/soccer/leagues/arg.1/teams/7?lang=es')).json().catch(e => ({ err:String(e) }));
await writeFile('out/team.json', JSON.stringify({ keys:Object.keys(j), venue:j.venue }, null, 1));
try { execSync('node scripts/fetch-estadios.mjs out klasito7/mi-streaming arg.1,uru.1,conmebol.libertadores,eng.1 > out/log.txt 2>&1', { timeout:1500000 }); } catch (e) { await writeFile('out/err.txt', String(e)); }
// v3
// v4
