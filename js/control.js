/* =========================================================
   📱 El celu como control remoto de la tele.
   El celu manda órdenes cortas ("canal 7", "volumen +", "flecha arriba") a un canal de ntfy.sh con un nombre
   largo y al azar (db.remote.topic, sincronizado entre tus aparatos). La tele escucha ese canal y las ejecuta.
   No viaja ningún dato tuyo: solo las órdenes. Si querés, generás un nombre nuevo en Ajustes y el viejo deja de andar.
   ========================================================= */
const Control = (() => {
  const NTFY = 'https://ntfy.sh/';
  const topic = () => { if (!db.remote?.topic) { db.remote = { topic:'funvs-' + Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 30) }; save(); } return db.remote.topic; };
  const listenOn = () => S.get('remoteRx', Lite.tv);   // ¿este aparato obedece? (la tele, sí; la compu y el celu, si lo prendés)
  let es = null, lastId = '';

  /* ---------- la tele: escucha y obedece ---------- */
  const key = k => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true, cancelable:true })) ?? document.dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true }));
  function run(o) {
    const sink = () => AudioMgr.sink(AudioMgr.active);
    switch (o.c) {
      case 'key': if (o.k === 'Enter' && document.activeElement && document.activeElement !== document.body) { key('Enter'); if (/BUTTON|A/.test(document.activeElement.tagName)) document.activeElement.click(); } else key(o.k); break;
      case 'back': FUNVSApp.back(); break;
      case 'menu': $('btnSettings')?.click(); break;
      case 'ch': Zap.step(o.d); break;
      case 'num': { const c = db.chans.find(x => +x.num === +o.n); if (c) Player.play(c); else toast(`<b>No hay canal ${esc(o.n)}</b>`, { cls:'info', ms:1500 }); break; }
      case 'play': { const c = db.chans.find(x => x.uid === o.uid); if (c) Player.play(c); break; }
      case 'radio': { const r = db.radios[o.i]; if (r) Radio.play(r); break; }
      case 'music': { const m = db.music.items.find(x => x.id === o.id); if (m) Musica.play(m); else if (o.id === 'album') Musica.playAlbum(); break; }
      case 'toggle': sink()?.toggle?.(); break;
      case 'mute': { const id = AudioMgr.active, s = sink(); if (s) s.muted?.() ? AudioMgr.focus(id) : s.mute(); break; }
      case 'vol': { const s = sink(); if (s?.setVol && s.getVol) s.setVol(Math.max(0, Math.min(1, s.getVol() + o.d))); break; }
      case 'tv': $('player').classList.contains('tvmode') ? TV.close() : TV.open(); break;
      case 'search': Buscar.open(); setTimeout(() => { const i = $('bQ'); if (i) { i.value = o.q; i.dispatchEvent(new Event('input')); } }, 50); break;
      case 'go': Nav.go(o.s); break;
      case 'sleep': Reloj.sleepIn(o.m); break;
      case 'off': try { Player.closeAll(); Radio.stop(); Musica.stop(); } catch {} break;
    }
    if (!['key', 'vol'].includes(o.c)) toast('📱 ' + ({ ch:'Canal', num:'Canal ' + o.n, play:'Canal', radio:'Radio', music:'Música', toggle:'Pausa / seguir', mute:'Silencio', tv:'Pantalla TV', search:'Buscar: ' + o.q, go:'Sección', sleep:'Apagado', off:'Apagar todo', back:'Atrás', menu:'Ajustes' }[o.c] || o.c), { cls:'info zapt', ms:1200 });
  }
  function listen() {
    try { es?.close(); } catch {} es = null;
    if (!listenOn()) return;
    es = new EventSource(NTFY + topic() + '/sse?since=' + Math.floor(Date.now() / 1000));
    es.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.event !== 'message' || m.id === lastId) return; lastId = m.id; const o = JSON.parse(m.message); if (o?.funvs !== 1 || Date.now() / 1000 - m.time > 30) return; run(o); } catch {} };
  }

  /* ---------- el celu: el control ---------- */
  async function send(o) {
    try { await fetch(NTFY + topic(), { method:'POST', body:JSON.stringify({ funvs:1, ...o }) }); navigator.vibrate?.(15); }
    catch { toast('<b>No llegó la orden</b><small>Revisá la conexión.</small>', { cls:'info' }); }
  }
  function open() {
    let d = $('dlgRemote'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRemote'; d.className = 'rmt'; document.body.appendChild(d); }
    d.innerHTML = `<div class="rmt-h"><b>📱 Control de la tele</b><button data-x>✕</button></div>
      <div class="rmt-row"><button data-o='{"c":"off"}' class="rmt-red">⏻</button><button data-o='{"c":"tv"}'>📺 TV</button><button data-o='{"c":"menu"}'>⚙</button><button data-o='{"c":"back"}'>↩</button></div>
      <div class="rmt-pad"><span></span><button data-o='{"c":"key","k":"ArrowUp"}'>▲</button><span></span>
        <button data-o='{"c":"key","k":"ArrowLeft"}'>◀</button><button data-o='{"c":"key","k":"Enter"}' class="rmt-ok">OK</button><button data-o='{"c":"key","k":"ArrowRight"}'>▶</button>
        <span></span><button data-o='{"c":"key","k":"ArrowDown"}'>▼</button><span></span></div>
      <div class="rmt-row"><button data-o='{"c":"vol","d":-0.1}'>🔉</button><button data-o='{"c":"mute"}'>🔇</button><button data-o='{"c":"vol","d":0.1}'>🔊</button><button data-o='{"c":"toggle"}'>⏯</button></div>
      <div class="rmt-row"><button data-o='{"c":"ch","d":-1}'>CH ▲</button><button data-o='{"c":"ch","d":1}'>CH ▼</button></div>
      <form class="rmt-num" id="rmNum"><input id="rmN" inputmode="numeric" placeholder="N° de canal" maxlength="3"><button>Ir</button></form>
      <form class="rmt-num" id="rmQ"><input id="rmQi" placeholder="🔎 Buscar en la tele…"><button>Buscar</button></form>
      <details class="rmt-list"><summary>📺 Canales</summary>${db.chans.map(c => `<button data-o='${JSON.stringify({ c:'play', uid:c.uid })}'><i>${esc(Canales.numTxt(c))}</i> ${esc(c.name)}${Canales.status[c.uid]?.st === 'live' ? ' <b class="lv">●</b>' : ''}</button>`).join('')}</details>
      <details class="rmt-list"><summary>📻 Radios</summary>${db.radios.map((r, i) => `<button data-o='{"c":"radio","i":${i}}'>${esc(r.name)}</button>`).join('')}</details>
      <details class="rmt-list"><summary>🎵 Música</summary><button data-o='{"c":"music","id":"album"}'>💿 Álbum del día</button>${db.music.items.map(m => `<button data-o='${JSON.stringify({ c:'music', id:m.id })}'>${esc(m.name || m.ref)}</button>`).join('')}</details>
      <div class="rmt-row"><button data-o='{"c":"sleep","m":30}'>🌙 30′</button><button data-o='{"c":"sleep","m":60}'>🌙 60′</button><button data-o='{"c":"go","s":"inicio"}'>🏠</button><button data-o='{"c":"go","s":"velez"}'>💙</button></div>`;
    d.showModal();
    d.onclick = e => { if (e.target.closest('[data-x]')) return d.close(); const b = e.target.closest('[data-o]'); if (b) send(JSON.parse(b.dataset.o.replace(/&#39;/g, "'"))); };
    $('rmNum').onsubmit = e => { e.preventDefault(); const n = $('rmN').value.trim(); if (n) send({ c:'num', n }); $('rmN').value = ''; };
    $('rmQ').onsubmit = e => { e.preventDefault(); const q = $('rmQi').value.trim(); if (q) send({ c:'search', q }); };
  }
  function init() {
    $('btnGraf').insertAdjacentHTML('beforebegin', '<button id="btnRemote" title="Usar el celu como control de la tele">📱</button>');
    $('btnRemote').onclick = open;
    // en Ajustes: si este aparato obedece al control y un nombre nuevo para el canal
    $('setLite')?.closest('label')?.insertAdjacentHTML('afterend', `<label style="display:flex;gap:6px;align-items:center;color:var(--txt)"><input type="checkbox" id="setRx" style="width:auto" ${listenOn() ? 'checked' : ''}> 📱 Este aparato obedece al control desde el celu (en la tele, prendido)</label>
      <div style="font-size:12px;margin:-2px 0 6px 24px" class="mut">Canal privado del control: <code id="rmTopic"></code> <button type="button" class="sm" id="rmNew">Generar otro</button></div>`);
    if ($('setRx')) {
      $('setRx').onchange = e => { S.set('remoteRx', e.target.checked); listen(); };
      $('rmTopic').textContent = topic().slice(0, 12) + '…';
      $('rmNew').onclick = () => { if (!confirm('¿Generar un canal nuevo? El celu y la tele lo toman solos al sincronizar.')) return; db.remote = null; topic(); $('rmTopic').textContent = topic().slice(0, 12) + '…'; listen(); toast('📱 Canal nuevo del control', { ms:2000 }); };
    }
    listen();
    onChange?.(() => { if (es && db.remote?.topic && !es.url.includes(db.remote.topic)) listen(); });
  }
  return { init, open, send, run };
})();
