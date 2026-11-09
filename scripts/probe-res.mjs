import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const k = process.env.YT_KEY;
const v = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=WohLyKJ4d_A&key=${k}`)).json();
const cid = v.items?.[0]?.snippet?.channelId;
const c = cid ? await (await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${cid}&key=${k}`)).json() : null;
const rss = cid ? await (await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + cid)).text() : '';
await writeFile('out/res.json', JSON.stringify({ v:v.items?.[0]?.snippet && { title:v.items[0].snippet.title, ch:v.items[0].snippet.channelTitle, cid, live:v.items[0].snippet.liveBroadcastContent }, err:v.error?.message, c:c?.items?.[0]?.snippet && { title:c.items[0].snippet.title, custom:c.items[0].snippet.customUrl, thumb:c.items[0].snippet.thumbnails?.medium?.url }, rssStatus:rss.slice(0, 300), rssEntries:(rss.match(/<entry>/g) || []).length }, null, 1));
