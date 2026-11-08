// 📲 Avisos de FUNVS por Telegram. Lo corre GitHub cada ~10 minutos (workflow "telegram").
// Si hay un partido de tus equipos en juego (o por empezar), se queda revisando cada 45 s hasta la próxima corrida.
// Configuración: db.tg del Gist privado (secreto GIST_ID). Estado entre corridas: archivo que guarda la caché de GitHub.
// Uso: node scripts/alertas.mjs archivo_estado [usuario/repo]
import { readFile, writeFile } from 'node:fs/promises';
import { readDb, norm } from './gist.mjs';
const stFile = process.argv[2] || 'tg-state.json', repo = process.argv[3] || 'klasito7/mi-streaming';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJ = async (u, o) => { try { const r = await fetch(u, o); return r.ok ? await r.json() : null; } catch { return null; } };
const getT = async u => { try { const r = await fetch(u); return r.ok ? await r.text() : ''; } catch { return ''; } };
const raw = f => `https://raw.githubusercontent.com/${repo}/datos/${f}?t=${Date.now()}`;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const db = await readDb();
const tg = db?.tg || {}, token = process.env.TELEGRAM_TOKEN || tg.token, chat = tg.chat;
if (!token || !chat) { console.log('Telegram: falta configurar el bot en FUNVS (o el secreto GIST_ID). Nada que hacer.'); try { await readFile(stFile); } catch { await writeFile(stFile, '{}'); } process.exit(0); }
const on = tg.on || {};

let st = {}; try { st = JSON.parse(await readFile(stFile, 'utf8')); } catch {}
st.sent = st.sent || {}; st.games = st.games || {}; st.live = st.live || {};
const first = !st.init; st.init = true;
for (const [k, t] of Object.entries(st.sent)) if (Date.now() - t > 10 * 864e5) delete st.sent[k];

// hora argentina
const ar = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone:'America/Argentina/Buenos_Aires', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); return { ymd:`${p.year}-${p.month}-${p.day}`, h:+p.hour, m:+p.minute }; };
const mins = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
function quiet() {
  const q = tg.quiet; if (!q?.on) return false;
  const n = ar(), now = n.h * 60 + n.m, a = mins(q.from), b = mins(q.to);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}
let sentCount = 0;
async function send(key, html, important = false) {
  if (st.sent[key]) return;
  st.sent[key] = Date.now();
  if (first && !important) return;                  // primera corrida: solo aprende el estado, no inunda
  if (quiet() && !important) return;
  const r = await getJ(`https://api.telegram.org/bot${token}/sendMessage`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ chat_id:chat, text:html, parse_mode:'HTML' }) });
  if (r?.ok) sentCount++; else console.log('Telegram: no se pudo mandar un aviso');
}

/* ---------- ⚽ partidos de tus equipos ---------- */
const teams = (db.futbol?.teams || []).map(norm).filter(Boolean);
const isFav = t => { const a = norm(t.displayName), b = norm(t.shortDisplayName); return teams.some(f => a.includes(f) || f.includes(a) || (b && (b.includes(f) || f.includes(b)))); };
let tv = null;
async function futbol() {
  let hot = false;
  for (const lg of db.futbol?.leagues || ['arg.1']) {
    const sb = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard`);
    for (const ev of sb?.events || []) {
      const c = ev.competitions?.[0]; if (!c) continue;
      const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
      if (!H || !A || !(isFav(H.team) || isFav(A.team))) continue;
      const s = ev.status.type.state, h = +H.score || 0, a = +A.score || 0, start = Date.parse(ev.date);
      const name = `${H.team.shortDisplayName} vs ${A.team.shortDisplayName}`, score = `${esc(H.team.shortDisplayName)} <b>${h}-${a}</b> ${esc(A.team.shortDisplayName)}`;
      const lgName = sb.leagues?.[0]?.name || '';
      if (s === 'in' || (s === 'pre' && start - Date.now() < 12 * 60e3)) hot = true;
      const p = st.games[ev.id];
      // 15 min antes, con el canal
      if (on.partido && s === 'pre' && start - Date.now() < 16 * 60e3 && start > Date.now()) {
        tv = tv || await getJ(raw('tv.json'));
        const m = (tv?.matches || []).find(x => [x.home, x.away].some(n => norm(n).includes(norm(H.team.shortDisplayName)) || norm(H.team.shortDisplayName).includes(norm(n))));
        await send('pre15:' + ev.id, `⏰ <b>En 15 minutos</b>\n${esc(name)}${lgName ? ' · ' + esc(lgName) : ''}${m?.channels?.length ? '\n📺 ' + esc(m.channels.join(' · ')) : ''}`, true);
      }
      if (p) {
        if (on.partido && p.s === 'pre' && s === 'in') await send('ini:' + ev.id, `🟢 <b>Arrancó</b> ${esc(name)}${lgName ? '\n' + esc(lgName) : ''}`, true);
        if (on.goles && (h !== p.h || a !== p.a)) {
          const det = (c.details || []).filter(d => d.scoringPlay).pop();
          const who = det?.athletesInvolved?.[0]?.displayName, min = det?.clock?.displayValue;
          const side = (h > p.h ? H : a > p.a ? A : null);
          if (side) await send(`gol:${ev.id}:${h}-${a}`, `${isFav(side.team) ? '⚽ <b>¡GOOOL de ' + esc(side.team.shortDisplayName) + '!</b>' : '⚽ Gol de ' + esc(side.team.shortDisplayName)}${who ? `\n${esc(who)}${min ? ' ' + esc(min) : ''}` : ''}\n${score}`, true);
          else await send(`anul:${ev.id}:${h}-${a}`, `❌ Gol anulado\n${score}`, true);
        }
        if (on.partido && p.s === 'in' && s === 'post') {
          const fav = isFav(H.team) ? [h, a] : [a, h];
          await send('fin:' + ev.id, `🏁 <b>Final</b> ${fav[0] > fav[1] ? '✅' : fav[0] < fav[1] ? '❌' : '🤝'}\n${score}`, true);
        }
      }
      st.games[ev.id] = { s, h, a, t:Date.now() };
    }
  }
  for (const [k, g] of Object.entries(st.games)) if (Date.now() - g.t > 2 * 864e5) delete st.games[k];
  return hot;
}

/* ---------- 🔴 canales elegidos ---------- */
async function canales() {
  if (!on.canales) return;
  const chans = (db.chans || []).filter(c => (tg.chans || []).includes(c.uid));
  const ids = [], owner = {};
  for (const c of chans.filter(c => c.platform === 'youtube' && c.ref.channelId)) {
    const xml = await getT('https://www.youtube.com/feeds/videos.xml?channel_id=' + c.ref.channelId);
    for (const m of [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].slice(0, 4)) { ids.push(m[1]); owner[m[1]] = c; }
  }
  if (ids.length && db.key) {
    for (let i = 0; i < ids.length; i += 50) {
      const j = await getJ(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.slice(i, i + 50).join(',')}&key=${db.key}`);
      for (const v of j?.items || []) {
        if (v.snippet.liveBroadcastContent !== 'live' || (v.contentDetails?.duration && v.contentDetails.duration !== 'P0D')) continue;   // estrenos no
        await send('yt:' + v.id, `🔴 <b>${esc(owner[v.id].name)}</b> está en vivo\n${esc(v.snippet.title)}\nhttps://youtu.be/${v.id}`);
      }
    }
  }
  for (const c of chans.filter(c => c.platform === 'twitch' || c.platform === 'kick')) {
    let live = false, title = '';
    if (c.platform === 'twitch') { const u = await getT('https://decapi.me/twitch/uptime/' + c.ref.name); live = !!u && !/offline|error|not found/i.test(u); if (live) title = await getT('https://decapi.me/twitch/title/' + c.ref.name); }
    else { const k = await getJ('https://kick.com/api/v2/channels/' + c.ref.name, { headers:{ 'User-Agent':'Mozilla/5.0', Accept:'application/json' } }); live = !!k?.livestream; title = k?.livestream?.session_title || ''; }
    const key = c.platform + ':' + c.ref.name;
    if (live && !st.live[key]) await send(`${key}:${Date.now()}`, `🔴 <b>${esc(c.name)}</b> está en vivo${title ? '\n' + esc(title) : ''}\nhttps://${c.platform === 'twitch' ? 'twitch.tv' : 'kick.com'}/${c.ref.name}`);
    st.live[key] = live;
  }
}

/* ---------- 🏁 automovilismo ---------- */
const CAT = { f1:'Fórmula 1', motogp:'MotoGP', nascar:'NASCAR', tc:'Turismo Carretera', tc2000:'TC2000', toprace:'Top Race' };
async function motor() {
  if (!on.motor) return;
  const m = await getJ(raw('motor.json'));
  for (const [id, c] of Object.entries(m?.cats || {})) {
    for (const s of c.next?.sessions || []) {
      if (s.dayOnly || (!s.key && !db.motor?.practice)) continue;
      const t = Date.parse(s.start), left = t - Date.now();
      if (left > 0 && left < 17 * 60e3) await send(`mot:${id}:${s.start}`, `🏁 <b>En ${Math.round(left / 60e3)} min: ${esc(CAT[id] || id)}</b>\n${esc(s.name)} · ${esc(c.next.name)}${c.tv?.length ? '\n📺 ' + esc(c.tv.slice(0, 3).join(' · ')) : ''}`);
    }
  }
}

/* ---------- 🎬 resúmenes nuevos ---------- */
async function resumenes() {
  if (!on.resumenes) return;
  const r = await getJ(raw('resumenes.json'));
  for (const it of r?.items || []) if (it.video && Date.now() - Date.parse(it.date) < 4 * 864e5)
    await send('res:' + it.k, `🎬 <b>Ya está el resumen</b>\n${esc(it.title)}${it.sub ? '\n' + esc(it.sub) : ''}\nhttps://youtu.be/${it.video.id}`);
}

/* ---------- 📄 REPROCANN y 🍃 4:20 ---------- */
async function diario() {
  const n = ar();
  const rp = db.diario?.repro;
  if (on.repro && rp?.vence && rp.aviso !== false && n.h >= 10) {
    const left = Math.round((Date.parse(rp.vence + 'T12:00:00Z') - Date.parse(n.ymd + 'T12:00:00Z')) / 864e5);
    if ([60, 30, 15, 7, 1, 0].includes(left) || (left < 0 && left % 7 === 0))
      await send(`repro:${rp.vence}:${left}`, `📄 <b>REPROCANN</b>\n${left > 0 ? `Vence en ${left} día${left === 1 ? '' : 's'}` : left === 0 ? 'Vence HOY' : `Venció hace ${-left} días`} (${rp.vence.split('-').reverse().join('/')})`);
  }
  if (on.t420 && [4, 16].includes(n.h) && n.m >= 20 && n.m < 40) await send(`420:${n.ymd}:${n.h}`, `🍃 Son las ${n.h}:20`);
}

/* ---------- vuelta principal ---------- */
const until = Date.now() + 9 * 60e3;
let hot = await futbol();
await canales(); await motor(); await resumenes(); await diario();
while (hot && !process.env.NO_LOOP && Date.now() + 45e3 < until) { await writeFile(stFile, JSON.stringify(st)); await sleep(45e3); hot = await futbol(); }
await writeFile(stFile, JSON.stringify(st));
console.log(`Telegram: ${sentCount} aviso(s) enviado(s)${first ? ' (primera corrida: aprendí el estado)' : ''}`);
