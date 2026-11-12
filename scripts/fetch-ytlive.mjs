// 🔴 Vivos "escondidos": canales que tienen un vivo 24/7 empezado hace mucho (A24, La Red, Radio 10, Cadena 3…)
// no lo muestran entre sus últimos 50 videos, así que FUNVS no lo veía. Este robot los busca con la API de YouTube
// (clave YT_KEY de GitHub, aparte de la tuya), de a poquito y con tope diario, y guarda los IDs de vivo de cada canal.
// FUNVS después los revisa casi gratis (1 unidad cada 50 videos).
// Uso: node scripts/fetch-ytlive.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb } from './gist.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const key = process.env.YT_KEY, DAY_MAX = 5000, PER_RUN = 8;   // búsquedas: 100 unidades cada una
const prev = await fetch(`https://raw.githubusercontent.com/${repo}/datos/ytlive.json?t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null) || { ch:{} };
const out = { at:new Date().toISOString(), day:prev.day, used:prev.used || 0, ch:prev.ch || {} };
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // día de Argentina
if (out.day !== today) { out.day = today; out.used = 0; }
const done = async () => { await writeFile(dir + '/ytlive.json', JSON.stringify(out)); };
const db = await readDb().catch(() => null);
if (!key || !db) { await done(); console.log('Vivos: falta YT_KEY o la config'); process.exit(0); }
const yt = async (p, q) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + p); Object.entries({ ...q, key }).forEach(([k, v]) => u.searchParams.set(k, v)); const j = await (await fetch(u)).json(); if (j.error) throw new Error(j.error.message); return j; };
const cids = [...new Set((db.chans || []).filter(c => c.platform === 'youtube' && c.ref?.channelId && !c.ref.video).map(c => c.ref.channelId))];
for (const k of Object.keys(out.ch)) if (!cids.includes(k)) delete out.ch[k];
cids.forEach(c => out.ch[c] = out.ch[c] || { lives:[], s:0 });
// 1) ¿siguen en vivo los que ya conocía? (barato)
const known = cids.flatMap(c => out.ch[c].lives);
const alive = new Set();
for (let i = 0; i < known.length; i += 50) {
  try { const j = await yt('videos', { part:'snippet', id:known.slice(i, i + 50).join(',') }); out.used += 1;
    (j.items || []).forEach(v => { if (v.snippet.liveBroadcastContent === 'live' || v.snippet.liveBroadcastContent === 'upcoming') alive.add(v.id); }); } catch (e) { console.log('videos:', e.message); }
}
const ended = [];
for (const c of cids) { const o = out.ch[c], before = o.lives.length; o.lives = o.lives.filter(v => alive.has(v)); if (before && o.lives.length < before) ended.push(c); }
// 2) buscar: primero los que se les cortó un vivo (seguro arrancaron otro), después los que hace más que no busco
const order = [...ended, ...cids.filter(c => !ended.includes(c)).sort((a, b) => out.ch[a].s - out.ch[b].s)];
let n = 0;
for (const c of order) {
  if (n >= PER_RUN || out.used + 100 > DAY_MAX) break;
  if (!ended.includes(c) && Date.now() - out.ch[c].s < 3 * 3600e3) continue;   // no repetir antes de 3 h
  try {
    const j = await yt('search', { part:'id', channelId:c, eventType:'live', type:'video', maxResults:10 }); out.used += 100; n++;
    const ids = (j.items || []).map(x => x.id.videoId).filter(Boolean);
    out.ch[c].lives = [...new Set([...out.ch[c].lives, ...ids])].slice(0, 10); out.ch[c].s = Date.now();
  } catch (e) { console.log('search:', e.message); break; }
}
// 3) 📼 últimos vivos terminados de cada canal (para no perderte programas): lista de subidas (1 unidad) + datos del video (1 cada 50)
const vprev = await fetch(`https://raw.githubusercontent.com/${repo}/datos/vods.json?t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null) || { ch:{} };
const vods = { at:new Date().toISOString(), ch:{} };
const names = Object.fromEntries((db.chans || []).filter(c => c.ref?.channelId).map(c => [c.ref.channelId, c.name]));
let vu = 0;
for (const c of cids) {
  const old = vprev.ch?.[c];
  if (old && Date.now() - (old.s || 0) < 90 * 60e3) { vods.ch[c] = old; continue; }   // cada canal, como mucho cada hora y media
  try {
    const pl = await yt('playlistItems', { part:'contentDetails', playlistId:'UU' + c.slice(2), maxResults:20 }); vu++;
    const ids = (pl.items || []).map(x => x.contentDetails.videoId).filter(Boolean);
    const vj = ids.length ? await yt('videos', { part:'snippet,liveStreamingDetails,contentDetails', id:ids.join(',') }) : { items:[] }; vu++;
    const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || '') || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
    const vids = (vj.items || []).filter(v => v.liveStreamingDetails?.actualEndTime && Date.now() - Date.parse(v.liveStreamingDetails.actualEndTime) < 21 * 864e5)
      .map(v => ({ id:v.id, t:v.snippet.title, a:v.liveStreamingDetails.actualStartTime, e:v.liveStreamingDetails.actualEndTime, d:dur(v.contentDetails?.duration),
        th:(v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url || '' }))
      .sort((x, y) => Date.parse(y.a) - Date.parse(x.a)).slice(0, 12);
    vods.ch[c] = { n:names[c] || '', s:Date.now(), vids };
  } catch (e) { console.log('vods:', e.message); if (old) vods.ch[c] = old; }
}
out.used += vu;
await writeFile(dir + '/vods.json', JSON.stringify({ ...vods, updated: new Date().toISOString() }));
console.log(`Últimos vivos: ${Object.values(vods.ch).reduce((a, x) => a + (x.vids?.length || 0), 0)} vivos terminados de ${Object.keys(vods.ch).length} canales (${vu} unidades)`);
await done();
console.log(`Vivos: ${n} búsquedas, ${Object.values(out.ch).filter(o => o.lives.length).length}/${cids.length} canales con vivo conocido, ${out.used} unidades hoy`);
