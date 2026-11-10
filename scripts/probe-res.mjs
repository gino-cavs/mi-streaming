// probe temporal: compara cómo detecta FUNVS los vivos vs la búsqueda de YouTube (eventType=live)
import { readDb } from './gist.mjs';
const db = await readDb(); const key = process.env.YT_KEY;
if (!db) { console.log('sin db'); process.exit(0); }
const yt = async (p, q) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + p); Object.entries({ ...q, key }).forEach(([k, v]) => u.searchParams.set(k, v)); return (await fetch(u)).json(); };
const sh = db.ytShare; console.log('ytShare:', sh ? `${sh.dev?.split('-')[0]} hace ${Math.round((Date.now() - sh.at) / 60e3)} min, ${Object.keys(sh.st || {}).length} canales` : 'no');
const rss = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCj6PcyLvpnIRT_2W_mwa9Aw', { headers:{ 'User-Agent':'Mozilla/5.0' } }); console.log('RSS desde GitHub:', rss.status);
const list = (db.chans || []).filter(c => c.platform === 'youtube').sort((a, b) => a.num - b.num);
console.log('canales youtube:', list.length);
for (const c of list) {
  const r = c.ref || {}; let line = `${c.num} ${c.name} | ${r.video ? 'video fijo ' + r.video : r.channelId ? 'cid' : 'handle ' + r.handle}`;
  try {
    let cid = r.channelId, up = r.uploads;
    if (!r.video && (!cid || !up)) { const j = await yt('channels', { part:'contentDetails', ...(cid ? { id:cid } : { forHandle:r.handle }) }); cid = j.items?.[0]?.id; up = j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads; line += ` (resuelto ${!!cid})`; }
    let found = [];
    if (r.video) { const v = await yt('videos', { part:'snippet', id:r.video }); line += ` estado:${v.items?.[0]?.snippet?.liveBroadcastContent} "${v.items?.[0]?.snippet?.title?.slice(0, 40)}"`; }
    else if (up) {
      const j = await yt('playlistItems', { part:'contentDetails', playlistId:up, maxResults:50 }); const ids = (j.items || []).map(i => i.contentDetails.videoId);
      const v = await yt('videos', { part:'snippet,liveStreamingDetails', id:ids.join(',') });
      found = (v.items || []).filter(x => x.snippet.liveBroadcastContent === 'live').map(x => x.id + '@' + ids.indexOf(x.id));
      const s = await yt('search', { part:'snippet', channelId:cid, eventType:'live', type:'video', maxResults:5 });
      const real = (s.items || []).map(x => x.id.videoId);
      const st = sh?.st?.[c.uid];
      line += ` | uploads50: ${found.join(',') || '-'} | search live: ${real.join(',') || '-'} | share: ${st ? st.st + ' ' + st.vid : 'sin dato'}`;
      if (s.error) line += ' ERR ' + s.error.message;
    }
  } catch (e) { line += ' ERROR ' + e.message; }
  console.log(line);
}
