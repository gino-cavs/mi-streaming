import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (FUNVS uso personal)' };
const raw = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(20000) }); return [r.status, await r.text()]; } catch (e) { return [0, 'ERR ' + e]; } };
const out = {};
for (const u of ['https://elnine.com.ar/', 'https://www.dataredonda.com/', 'https://www.dataredonda.com/sitemap.xml', 'https://elnine.com.ar/sitemap.xml', 'https://elnine.com.ar/sitemap_index.xml']) {
  const [s, t] = await raw(u);
  out[u] = s + ' ' + t.length + ' bytes\n' + [...new Set((t.match(/(?:href="|<loc>)([^"<]*(?:reserv|proyecc)[^"<]*)/gi) || []))].slice(0, 30).join('\n') + '\n--links--\n' + [...new Set((t.match(/(?:href="|<loc>)(https?:\/\/[^"<]*|\/[^"<]{2,80})/g) || []))].slice(0, 60).join(' ');
}
await writeFile('out/res.json', JSON.stringify(out, null, 1));
