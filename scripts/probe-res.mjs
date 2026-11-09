import { execSync } from 'node:child_process'; import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
try { await writeFile('out/log.txt', execSync('node scripts/fetch-mg.mjs out klasito7/mi-streaming 2>&1').toString()); } catch (e) { await writeFile('out/log.txt', String(e.stdout || e)); }
// v2
