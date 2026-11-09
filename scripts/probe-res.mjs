import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const H = { Authorization:'Bearer ' + process.env.GH_TOKEN, Accept:'application/vnd.github+json' }, R = process.env.REPO;
const runs = await (await fetch(`https://api.github.com/repos/${R}/actions/runs?per_page=8`, { headers:H })).json();
let out = '';
for (const r of runs.workflow_runs || []) {
  out += `${r.name} ${r.event} ${r.status} ${r.conclusion} ${r.created_at} ${r.head_sha.slice(0,7)}\n`;
  if (r.name !== 'probe') { const j = await (await fetch(r.jobs_url, { headers:H })).json(); for (const jb of j.jobs || []) for (const st of jb.steps || []) if (st.conclusion !== 'success' && st.conclusion !== 'skipped') out += `   - ${st.name}: ${st.status} ${st.conclusion} ${st.started_at}→${st.completed_at}\n`; }
}
await writeFile('out/runs.txt', out);
