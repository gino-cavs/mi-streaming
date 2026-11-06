/* =========================================================
   Canales: YouTube, Twitch y Kick con estado en vivo / programado
   ========================================================= */
const NET_MSG = 'No me pude conectar con YouTube. Si estás viendo la página dentro de Claude (vista previa), ahí no funciona: abrila desde tu link de GitHub Pages. Si ya estás ahí, revisá que el bloqueador de anuncios no esté bloqueando "googleapis.com".';

const Canales = (() => {
  const status = S.get('hub2status', {});   // uid -> {st:'live'|'soon'|'off'|'?', title, thumb, vid, when, viewers}
  let tab = S.get('hub2tab', 'live'), lastUpd = null, busy = false, editing = null;

  /* ---------- Leer links ---------- */
  function parse(raw) {
    let s = raw.trim();
    if (!s) return null;
    if (/^@[\w.\-]+$/.test(s)) return { platform:'youtube', ref:{ handle:s } };
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u; try { u = new URL(s); } catch { return null; }
    const h = u.hostname.replace(/^(www|m)\./, '');
    const p = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (h === 'twitch.tv' && p[0]) return { platform:'twitch', ref:{ name:p[0].toLowerCase() } };
    if (h === 'kick.com' && p[0]) return { platform:'kick', ref:{ name:p[0].toLowerCase() } };
    if (h === 'youtu.be' && p[0]) return { platform:'youtube', ref:{ video:p[0] } };
    if (h.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return { platform:'youtube', ref:{ video:u.searchParams.get('v') } };
      if (['live', 'shorts', 'embed'].includes(p[0]) && p[1]) return { platform:'youtube', ref:{ video:p[1] } };
      if (p[0] === 'channel' && p[1]) return { platform:'youtube', ref:{ channelId:p[1] } };
      if (p[0] && p[0].startsWith('@')) return { platform:'youtube', ref:{ handle:p[0] } };
    }
    return null;
  }

  /* ---------- YouTube API ---------- */
  async function yt(path, params) {
    const q = new URLSearchParams({ ...params, key:db.key });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${q}`);
    const j = await r.json();
    if (j.error) {
      const m = j.error.message || '';
      if (/referer|referrer/i.test(m)) throw new Error('Tu clave de YouTube no permite este sitio: en Google Cloud, en la restricción de "Sitios web", agregá ' + location.origin + '/*');
      if (/API key not valid/i.test(m)) throw new Error('La clave de YouTube no es válida: revisá que esté bien copiada en ⚙.');
      if (/has not been used|disabled/i.test(m)) throw new Error('Falta habilitar "YouTube Data API v3" en tu proyecto de Google Cloud.');
      if (/quota/i.test(m)) throw new Error('Se terminó la cuota gratis de YouTube por hoy. Mañana vuelve sola; podés subir el tiempo de actualización en ⚙.');
      throw new Error(m || 'Error de YouTube');
    }
    return j;
  }
  async function resolveYT(c) {
    if (c.ref.video || c.ref.uploads) return;
    const params = { part:'snippet,contentDetails' };
    if (c.ref.channelId) params.id = c.ref.channelId; else params.forHandle = c.ref.handle;
    const j = await yt('channels', params);
    const ch = j.items && j.items[0];
    if (!ch) throw new Error('No encontré ese canal de YouTube');
    c.ref.channelId = ch.id;
    c.ref.uploads = ch.contentDetails.relatedPlaylists.uploads;
    c.avatar = (ch.snippet.thumbnails.medium || ch.snippet.thumbnails.default).url;
    if (!c.name || c.name === c.ref.handle) c.name = ch.snippet.title;
  }
  async function refreshYT() {
    const list = db.chans.filter(c => c.platform === 'youtube');
    if (!list.length) return;
    if (!db.key) { list.forEach(c => status[c.uid] = { st:'?' }); return; }
    const want = {};
    for (const c of list) {
      try {
        if (c.ref.video) { want[c.uid] = [c.ref.video]; continue; }
        await resolveYT(c);
        const j = await yt('playlistItems', { part:'contentDetails', playlistId:c.ref.uploads, maxResults:15 });
        want[c.uid] = j.items.map(i => i.contentDetails.videoId);
      } catch (e) {
        status[c.uid] = { st:'?', err:e.message };
        warn(e instanceof TypeError ? NET_MSG : 'YouTube: ' + e.message);
        if (e instanceof TypeError) break;
      }
    }
    saveLocal();
    const ids = [...new Set(Object.values(want).flat())];
    const vids = {};
    for (let i = 0; i < ids.length; i += 50) {
      const j = await yt('videos', { part:'snippet,liveStreamingDetails', id:ids.slice(i, i + 50).join(',') });
      j.items.forEach(v => vids[v.id] = v);
    }
    const now = Date.now();
    for (const [u, l2] of Object.entries(want)) {
      const vs = l2.map(id => vids[id]).filter(Boolean);
      const live = vs.find(v => v.snippet.liveBroadcastContent === 'live');
      const soon = vs.filter(v => v.snippet.liveBroadcastContent === 'upcoming' && v.liveStreamingDetails?.scheduledStartTime
                     && Date.parse(v.liveStreamingDetails.scheduledStartTime) > now - 3 * 3600e3)
                     .sort((a, b) => Date.parse(a.liveStreamingDetails.scheduledStartTime) - Date.parse(b.liveStreamingDetails.scheduledStartTime))[0];
      const pick = live || soon;
      // últimos directos ya terminados (para Mundo Vélez)
      const past = vs.filter(v => v.liveStreamingDetails?.actualEndTime).slice(0, 3)
                     .map(v => ({ vid:v.id, title:v.snippet.title, end:v.liveStreamingDetails.actualEndTime, thumb:(v.snippet.thumbnails.medium || v.snippet.thumbnails.default).url }));
      if (pick) {
        const th = pick.snippet.thumbnails;
        status[u] = { st: live ? 'live' : 'soon', vid:pick.id, title:pick.snippet.title,
          thumb:(th.maxres || th.high || th.medium || th.default).url,
          when: live ? pick.liveStreamingDetails?.actualStartTime : pick.liveStreamingDetails.scheduledStartTime,
          viewers: live ? +pick.liveStreamingDetails?.concurrentViewers || null : null, past };
      } else {
        const last = vs[0];
        status[u] = { st:'off', vid:last?.id, title: last ? 'Último: ' + last.snippet.title : '', past };
      }
    }
  }
  async function refreshOthers() {
    await Promise.all(db.chans.filter(c => c.platform !== 'youtube').map(async c => {
      try {
        if (c.platform === 'twitch') {
          const t = await (await fetch(`https://decapi.me/twitch/uptime/${c.ref.name}`)).text();
          if (/offline/i.test(t)) { status[c.uid] = { st:'off' }; return; }
          if (/not found|error/i.test(t)) throw 0;
          let title = ''; try { title = await (await fetch(`https://decapi.me/twitch/title/${c.ref.name}`)).text(); } catch {}
          status[c.uid] = { st:'live', title, since:t };
        } else {
          const j = await (await fetch(`https://kick.com/api/v2/channels/${c.ref.name}`)).json();
          const ls = j.livestream;
          status[c.uid] = ls ? { st:'live', title:ls.session_title, viewers:ls.viewer_count, thumb:ls.thumbnail?.url } : { st:'off' };
          if (!c.avatar && j.user?.profile_pic) { c.avatar = j.user.profile_pic; saveLocal(); }
        }
      } catch { status[c.uid] = { st:'?' }; }
    }));
  }
  async function refresh() {
    if (busy) return; busy = true;
    $('btnRefresh').textContent = '…';
    await pull();
    try { await Promise.all([refreshYT().catch(e => warn(e instanceof TypeError ? NET_MSG : 'YouTube: ' + e.message)), refreshOthers()]); } catch {}
    lastUpd = new Date(); S.set('hub2status', status);
    busy = false; $('btnRefresh').textContent = '⟳';
    render(); Nav.badges();
  }

  /* ---------- Mostrar ---------- */
  const PCOL = { youtube:'var(--yt)', twitch:'var(--tw)', kick:'var(--kick)' };
  function whenTxt(iso) {
    const d = new Date(iso), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 864e5);
    if (d < now) return 'Por empezar (' + fmtH(d) + ')';
    if (diff === 0) return 'Hoy ' + fmtH(d);
    if (diff === 1) return 'Mañana ' + fmtH(d);
    return d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'numeric' }) + ' ' + fmtH(d);
  }
  const kfmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : String(n);
  function sortChans(arr) {
    const rank = c => ({ live:0, soon:1, off:2, '?':3 }[status[c.uid]?.st || '?']);
    return arr.slice().sort((a, b) => rank(a) - rank(b)
      || (rank(a) === 0 ? (status[b.uid].viewers || 0) - (status[a.uid].viewers || 0) : 0)
      || (rank(a) === 1 ? Date.parse(status[a.uid].when) - Date.parse(status[b.uid].when) : 0)
      || a.name.localeCompare(b.name));
  }
  function card(c) {
    const s = status[c.uid] || { st:'?' };
    let badge;
    if (s.st === 'live') badge = `<span class="badge live">● EN VIVO${s.viewers ? ' · ' + kfmt(s.viewers) : ''}</span>`;
    else if (s.st === 'soon') badge = `<span class="badge soon">🕒 ${esc(whenTxt(s.when))}</span>`;
    else if (s.st === 'off') badge = `<span class="badge">Sin vivo</span>`;
    else badge = `<span class="badge">${c.platform === 'youtube' && !db.key ? 'Falta clave de YouTube' : 'Estado desconocido'}</span>`;
    const showThumb = (s.st === 'live' || s.st === 'soon') && s.thumb;
    const initial = esc((c.name || '?').trim()[0]?.toUpperCase());
    const thumb = showThumb
      ? `<div class="thumb" style="background-image:url('${esc(s.thumb)}')">`
      : `<div class="thumb"><div class="av" style="${c.avatar ? `background-image:url('${esc(c.avatar)}')` : `background:${PCOL[c.platform]};color:#000`}">${c.avatar ? '' : initial}</div>`;
    const sub = s.title || (s.st === 'live' && s.since ? 'Hace ' + s.since : c.cat || '');
    return `<div class="card ${s.st === 'off' || s.st === '?' ? 'off' : ''}" tabindex="0" data-u="${c.uid}">
      <div class="cardbtns"><button data-e="${c.uid}" title="Editar">⋯</button><button data-au="${c.uid}" title="Escuchar sin video">🎧</button></div>
      ${thumb}${badge}<span class="plat" style="background:${PCOL[c.platform]}"></span></div>
      <div class="info"><div class="n">${esc(c.name)}</div><div class="t">${esc(sub)}</div></div></div>`;
  }
  // cualquier grilla de tarjetas (también la de Mundo Vélez) usa esto para los clics
  function bindGrid(el) {
    el.addEventListener('click', e => {
      const ed = e.target.closest('[data-e]');
      if (ed) { openCh(db.chans.find(c => c.uid === ed.dataset.e)); return; }
      const au = e.target.closest('[data-au]');
      if (au) { Player.play(db.chans.find(c => c.uid === au.dataset.au), { audio:true }); return; }
      const cd = e.target.closest('[data-u]');
      if (cd) Player.play(db.chans.find(c => c.uid === cd.dataset.u));
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.u) Player.play(db.chans.find(c => c.uid === e.target.dataset.u)); });
  }
  const liveCount = () => db.chans.filter(c => status[c.uid]?.st === 'live').length;

  function render() {
    const tabs = [{ id:'live', label:'🔴 En vivo ahora', n:liveCount() }, { id:'all', label:'Todos', n:db.chans.length },
      ...db.cats.map(k => ({ id:'c:' + k, label:k, n:db.chans.filter(c => c.cat === k).length }))];
    if (db.chans.some(c => !db.cats.includes(c.cat))) tabs.push({ id:'c:', label:'Sin categoría', n:db.chans.filter(c => !db.cats.includes(c.cat)).length });
    if (!tabs.some(t => t.id === tab)) tab = 'live';
    $('tabs').innerHTML = tabs.map(t =>
      `<button class="${t.id === tab ? 'on' : ''} ${t.id === 'live' ? 'livetab' : ''}" data-t="${esc(t.id)}">${esc(t.label)}<span class="cnt">${t.n}</span></button>`).join('');
    const m = $('chanGrid');
    if (!db.chans.length) {
      m.innerHTML = `<div class="empty">Todavía no agregaste canales.<br>Tocá <b>＋ Canal</b> y pegá el link, por ejemplo <b>youtube.com/@NombreDelCanal</b>.<br>Para ver si están en vivo o programados, cargá la clave de YouTube en ⚙.</div>`;
    } else if (tab === 'live') {
      const live = sortChans(db.chans.filter(c => status[c.uid]?.st === 'live'));
      const soon = sortChans(db.chans.filter(c => status[c.uid]?.st === 'soon'));
      m.innerHTML = (live.length ? `<h2 class="sec">En vivo ahora</h2><div class="grid">${live.map(card).join('')}</div>`
                                 : `<div class="empty">Nadie de tu lista está en vivo en este momento.</div>`)
                  + (soon.length ? `<h2 class="sec">Próximos programados</h2><div class="grid">${soon.map(card).join('')}</div>` : '');
    } else {
      const list = tab === 'all' ? db.chans : tab === 'c:' ? db.chans.filter(c => !db.cats.includes(c.cat)) : db.chans.filter(c => c.cat === tab.slice(2));
      m.innerHTML = list.length ? `<div class="grid">${sortChans(list).map(card).join('')}</div>` : `<div class="empty">No hay canales en esta categoría.</div>`;
    }
    $('upd').textContent = lastUpd ? 'Actualizado ' + fmtH(lastUpd) : '';
  }

  /* ---------- Diálogos: canal y categorías ---------- */
  function catOptions(selected) {
    return db.cats.map(k => `<option ${k === selected ? 'selected' : ''}>${esc(k)}</option>`).join('') + `<option value="" ${!db.cats.includes(selected) && editing ? 'selected' : ''}>Sin categoría</option>`;
  }
  function openCh(c) {
    editing = c || null;
    $('chTitle').textContent = c ? 'Editar canal' : 'Agregar canal';
    const url = !c ? '' : c.platform === 'twitch' ? 'twitch.tv/' + c.ref.name : c.platform === 'kick' ? 'kick.com/' + c.ref.name
      : c.ref.video ? 'youtube.com/watch?v=' + c.ref.video : c.ref.handle ? 'youtube.com/' + c.ref.handle : 'youtube.com/channel/' + c.ref.channelId;
    $('chUrl').value = url; $('chUrl').disabled = !!c;
    $('chName').value = c ? c.name : '';
    $('chCat').innerHTML = catOptions(c ? c.cat : (tab.startsWith('c:') ? tab.slice(2) : db.cats[0]));
    $('chDel').style.display = c ? '' : 'none';
    $('chMsg').textContent = '';
    $('dlgCh').showModal();
  }
  function renderCats() {
    $('catList').innerHTML = db.cats.map((k, i) =>
      `<div class="catrow"><input value="${esc(k)}" data-i="${i}"><button data-up="${i}" title="Subir">↑</button><button data-del="${i}" title="Borrar">✕</button></div>`).join('');
  }
  function init() {
    bindGrid($('chanGrid'));
    $('tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; S.set('hub2tab', tab); render(); } };
    $('btnRefresh').onclick = refresh;
    $('btnAdd').onclick = () => openCh(null);
    $('chDel').onclick = () => { db.chans = db.chans.filter(c => c !== editing); delete status[editing.uid]; save(); $('dlgCh').close(); render(); };
    $('chSave').onclick = async () => {
      const msg = $('chMsg'), name = $('chName').value.trim(), cat = $('chCat').value;
      if (editing) { editing.name = name || editing.name; editing.cat = cat; save(); $('dlgCh').close(); render(); return; }
      const p = parse($('chUrl').value);
      if (!p) { msg.className = 'msg err'; msg.textContent = 'No reconocí ese link. Probá con youtube.com/@canal, twitch.tv/canal o kick.com/canal.'; return; }
      const c = { uid:uid(), ...p, name: name || p.ref.handle || p.ref.name || p.ref.video || p.ref.channelId, cat };
      if (c.platform === 'youtube' && db.key && !c.ref.video) {
        msg.className = 'msg'; msg.textContent = 'Buscando el canal…';
        try { await resolveYT(c); if (name) c.name = name; }
        catch (e) { if (e instanceof TypeError) warn(NET_MSG + ' El canal quedó guardado igual.'); else { msg.className = 'msg err'; msg.textContent = e.message; return; } }
      }
      db.chans.push(c); save(); $('dlgCh').close(); render(); refresh();
    };
    $('btnCats').onclick = () => { renderCats(); $('dlgCats').showModal(); };
    $('catList').onchange = e => {
      const i = e.target.dataset.i; if (i == null) return;
      const old = db.cats[i], nu = e.target.value.trim();
      if (!nu || (db.cats.includes(nu) && nu !== old)) { e.target.value = old; return; }
      db.cats[i] = nu; db.chans.forEach(c => { if (c.cat === old) c.cat = nu; });
      if (db.velez.streamCat === old) db.velez.streamCat = nu;
      if (tab === 'c:' + old) tab = 'c:' + nu;
      save(); render();
    };
    $('catList').onclick = e => {
      if (e.target.dataset.del != null) { const k = db.cats.splice(+e.target.dataset.del, 1)[0]; db.chans.forEach(c => { if (c.cat === k) c.cat = ''; }); }
      else if (e.target.dataset.up != null) { const i = +e.target.dataset.up; if (i === 0) return; [db.cats[i - 1], db.cats[i]] = [db.cats[i], db.cats[i - 1]]; }
      else return;
      save(); renderCats(); render();
    };
    $('addCat').onclick = () => { const inp = $('newCat'), k = inp.value.trim(); if (k && !db.cats.includes(k)) { db.cats.push(k); save(); renderCats(); render(); } inp.value = ''; };
    $('newCat').onkeydown = e => { if (e.key === 'Enter') $('addCat').click(); };
    onChange(render);
  }
  return { init, render, refresh, card, bindGrid, sortChans, status, liveCount, yt, get lastUpd() { return lastUpd; } };
})();
