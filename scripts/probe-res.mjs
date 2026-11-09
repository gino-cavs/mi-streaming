import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const raw = async u => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(25000) }); return [r.status, await r.text()]; } catch (e) { return [0, 'ERR ' + e]; } };
const strip = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const P = ['https://www.c5n.com/vivo','https://lnmas.lanacion.com.ar/programas/','https://www.a24.com/programacion','https://www.canal26.com/programacion-de-canal-26/','https://www.stremiar.tv/canales/cronica'];
for (const u of P) {
  const host = new URL(u).origin, k = new URL(u).hostname;
  const [rs, rt] = await raw(host + '/robots.txt');
  const [s, t] = await raw(u);
  await writeFile(`out/${k}.robots.txt`, rs + '\n' + rt.slice(0, 6000));
  await writeFile(`out/${k}.html`, t);
  await writeFile(`out/${k}.txt`, s + '\n' + strip(t).slice(0, 30000));
}
