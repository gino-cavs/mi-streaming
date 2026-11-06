/* =========================================================
   Momentos guardados: ⭐ marca el minuto exacto de lo que estás viendo o escuchando
   ========================================================= */
const Momentos = (() => {
  let pending = null, filter = 'all';
  const fmtT = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

  // arma el momento según de dónde viene (pantalla de video, música o radio)
  function fromSlot(i) {
    const s = Player.slots[i]; if (!s) return null;
    const c = s.c, st = Canales.status[c.uid] || {};
    const base = { src:c.name, kind:c.platform, chan:c.uid || null, title:st.title || '' };
    if (s.e.kind === 'youtube' && s.e.id) {
      let t = 0; try { t = s.api && s.api.p && s.api.p.getCurrentTime ? s.api.p.getCurrentTime() : 0; } catch {}
      let title = base.title; try { title = s.api.p.getVideoData().title || title; } catch {}
      return { ...base, title, vid:s.e.id, t:Math.floor(t), url:`https://www.youtube.com/watch?v=${s.e.id}&t=${Math.floor(t)}s`, thumb:`https://i.ytimg.com/vi/${s.e.id}/mqdefault.jpg` };
    }
    if (s.e.kind === 'twitch') {
      let t = 0; try { t = s.api.p.getCurrentTime(); } catch {}
      return { ...base, t:Math.floor(t), url:`https://www.twitch.tv/${s.e.id}/videos?filter=archives`, live:true };
    }
    if (s.e.kind === 'kick') return { ...base, url:`https://kick.com/${s.e.id}/videos`, live:true };
    return null;
  }
  function fromMusic() {
    const cur = Musica.current, tr = Musica.track; if (!cur) return null;
    let t = 0; try { t = Musica.time(); } catch {}
    return { src:(tr && tr.by) || cur.name || 'Música', kind:'musica', title:(tr && tr.title) || cur.name, vid:tr && tr.vid, t:Math.floor(t),
      url:tr && tr.vid ? `https://music.youtube.com/watch?v=${tr.vid}` : '', thumb:tr && tr.vid ? `https://i.ytimg.com/vi/${tr.vid}/mqdefault.jpg` : cur.thumb };
  }
  function fromRadio() {
    const r = Radio.current; if (!r) return null;
    return { src:r.name, kind:'radio', title:'', url:'', thumb:r.logo || '', live:true };
  }
  function capture(source) {
    let m = null;
    if (source === 'music') m = fromMusic();
    else if (source === 'radio') m = fromRadio();
    else if (source && source.startsWith('slot')) m = fromSlot(+source.slice(4));
    if (!m) { toast('<b>No hay nada sonando para guardar</b>', { cls:'info', ms:3000 }); return; }
    pending = { id:uid(), at:new Date().toISOString(), note:'', ...m };
    $('mmPrev').innerHTML = `${pending.thumb ? `<img src="${esc(pending.thumb)}" alt="">` : '<div class="mmic">⭐</div>'}
      <div><b>${esc(pending.src)}</b><div class="mut" style="font-size:13px">${esc(pending.title || '')}</div>
      <div style="font-size:13px;margin-top:3px">${pending.t ? '⏱️ Minuto ' + fmtT(pending.t) : '🕒 ' + new Date(pending.at).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</div></div>`;
    $('mmNote').value = '';
    $('dlgMoment').showModal();
    setTimeout(() => $('mmNote').focus(), 50);
  }
  function saveIt() {
    if (!pending) return;
    pending.note = $('mmNote').value.trim();
    db.moments.unshift(pending);
    Stats.bump('momentos');
    save(); pending = null; $('dlgMoment').close();
    toast('<b>⭐ Momento guardado</b><small>Lo encontrás en la sección Momentos.</small>', { cls:'info', ms:3500, onclick:() => Nav.go('momentos') });
    if (Nav.current === 'momentos') render();
  }

  /* ---------- Sección ---------- */
  const ICON = { youtube:'▶', twitch:'🟣', kick:'🟢', musica:'🎵', radio:'📻' };
  function shareText(m) {
    return `⭐ ${m.src}${m.title ? ' — ' + m.title : ''}${m.t ? ' (min ' + fmtT(m.t) + ')' : ''}${m.note ? '\n“' + m.note + '”' : ''}${m.url ? '\n' + m.url : ''}`;
  }
  function render() {
    const v = $('v-momentos');
    const kinds = [...new Set(db.moments.map(m => m.kind))];
    const list = db.moments.filter(m => filter === 'all' || m.kind === filter);
    const byDay = {};
    list.forEach(m => { const d = new Date(m.at).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }); (byDay[d] = byDay[d] || []).push(m); });
    v.innerHTML = `
      <div class="subbar"><div class="tabs">
        <button data-f="all" class="${filter === 'all' ? 'on' : ''}">Todos <span class="cnt">${db.moments.length}</span></button>
        ${kinds.map(k => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${ICON[k] || '⭐'} ${({ youtube:'YouTube', twitch:'Twitch', kick:'Kick', musica:'Música', radio:'Radio' })[k] || k}</button>`).join('')}
      </div></div>
      ${list.length ? Object.entries(byDay).map(([d, ms]) => `<h2 class="sec">${esc(d)}</h2><div class="mmlist">${ms.map(m => `
        <div class="mm">
          ${m.thumb ? `<div class="mmth" style="background-image:url('${esc(m.thumb)}')">${m.t ? `<span>${fmtT(m.t)}</span>` : ''}</div>` : `<div class="mmth ic">${ICON[m.kind] || '⭐'}</div>`}
          <div class="mmb"><b>${esc(m.src)}</b>${m.title ? `<div class="mut" style="font-size:13px">${esc(m.title)}</div>` : ''}
            ${m.note ? `<div class="mmnote">“${esc(m.note)}”</div>` : ''}
            <div class="mut" style="font-size:12px">${fmtH(m.at)}${m.t ? ' · minuto ' + fmtT(m.t) : m.live ? ' · en vivo' : ''}</div>
            <div class="mmbtn">
              ${m.vid && m.kind !== 'musica' ? `<button class="sm pri" data-play="${m.id}">▶ Ver desde ahí</button>` : ''}
              ${m.url ? `<a class="sm lnk" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}
              <a class="sm lnk" href="https://wa.me/?text=${encodeURIComponent(shareText(m))}" target="_blank" rel="noopener">WhatsApp</a>
              <button class="sm" data-copy="${m.id}">Copiar</button>
              <button class="sm" data-del="${m.id}" title="Borrar">✕</button>
            </div></div></div>`).join('')}</div>`).join('')
      : `<div class="empty">Todavía no guardaste momentos.<br>Mientras mirás o escuchás algo, tocá <b>⭐</b> (en la pantalla del video, en la barra de música o radio, o en la Pantalla TV) y queda guardado el minuto exacto.</div>`}`;
    v.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } };
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { db.moments = db.moments.filter(m => m.id !== b.dataset.del); save(); render(); });
    v.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      const m = db.moments.find(x => x.id === b.dataset.copy);
      try { await navigator.clipboard.writeText(shareText(m)); b.textContent = '¡Copiado!'; } catch { b.textContent = 'No se pudo'; }
    });
    v.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      const m = db.moments.find(x => x.id === b.dataset.play);
      Player.play({ uid:'m_' + m.id, platform:'youtube', ref:{ video:m.vid }, name:m.src }, { start:m.t || 0 });
    });
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="dlgMoment"><h3>⭐ Guardar momento</h3><div class="mmprev" id="mmPrev"></div>
        <label>Nota (opcional)</label><input id="mmNote" placeholder="Ej: el gol de Romero, la entrevista a…">
        <div class="btns"><span class="sp"></span><button id="mmCancel">Cancelar</button><button class="pri" id="mmSave">Guardar</button></div></dialog>`);
    $('mmCancel').onclick = () => { pending = null; $('dlgMoment').close(); };
    $('mmSave').onclick = saveIt;
    $('mmNote').onkeydown = e => { if (e.key === 'Enter') saveIt(); };
    onChange(() => { if (Nav.current === 'momentos') render(); });
  }
  return { init, render, capture };
})();
