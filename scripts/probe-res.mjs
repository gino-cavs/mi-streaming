import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const H = { Authorization:'Bearer ' + process.env.GH_TOKEN, Accept:'application/vnd.github+json' }, R = process.env.REPO;
await new Promise(r => setTimeout(r, 240000));   // espero que termine la corrida de noticias
const runs = await (await fetch(`https://api.github.com/repos/${R}/actions/runs?per_page=10`, { headers:H })).json();
const r = (runs.workflow_runs || []).find(x => x.name.startsWith('Juntar') && x.status === 'completed');
const j = await (await fetch(r.jobs_url, { headers:H })).json();
const log = await (await fetch(`https://api.github.com/repos/${R}/actions/jobs/${j.jobs[0].id}/logs`, { headers:H })).text();
await writeFile('out/runs.txt', r.created_at + ' ' + r.conclusion + '\n' + log.split('\n').filter(l => /Temas 420|Grilla calendario|Álbum|YouTube:|Wikidata|Error|error/i.test(l)).slice(0, 80).join('\n'));
