import { writeFile, mkdir } from 'node:fs/promises'; import { execSync } from 'node:child_process';
await mkdir('out', { recursive:true });
const out = {};
for (const u of ['https://ssl.smn.gob.ar/dpd/zipopendata.php?dato=pron5d', 'https://ssl.smn.gob.ar/dpd/zipopendata.php?dato=tiepre', 'https://ssl.smn.gob.ar/dpd/descarga_opendata.php?file=observaciones/tiepre20261109.txt', 'https://ws.smn.gob.ar/map_items/forecast/1', 'https://ws1.smn.gob.ar/v1/forecast/location/4864', 'https://www.smn.gob.ar/alertas']) {
  try { const r = await fetch(u, { headers:{ 'User-Agent':'Mozilla/5.0' }, signal:AbortSignal.timeout(25000) }); const b = Buffer.from(await r.arrayBuffer());
    out[u] = r.status + ' ' + r.headers.get('content-type') + ' ' + b.length;
    if (u.includes('pron5d') && r.ok) { await writeFile('/tmp/p.zip', b); out.pron = execSync('cd /tmp && unzip -o -q p.zip -d p5 && ls p5 && grep -n -i -A12 "EZEIZA" p5/* | head -40').toString(); }
    else out[u] += '\n' + b.toString('utf8').slice(0, 600);
  } catch (e) { out[u] = 'ERR ' + e; }
}
// la 2x4 en radio-browser
const rb = await (await fetch('https://de1.api.radio-browser.info/json/stations/search?name=2x4&country=Argentina&hidebroken=true&order=clickcount&reverse=true&limit=10')).json().catch(() => []);
out.radios = rb.map(s => [s.name, s.url_resolved, s.codec, s.bitrate, s.lastcheckok, s.clickcount, s.hls].join(' | '));
await writeFile('out/res.json', JSON.stringify(out, null, 1));
