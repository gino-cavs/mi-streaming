/* =========================================================
   📲 Avisos por Telegram: acá se configura el bot y qué avisar.
   Los avisos los manda GitHub (workflow "telegram"), así llegan aunque FUNVS esté cerrado.
   La configuración viaja en db.tg (Gist privado); GitHub la lee con el secreto GIST_ID.
   ========================================================= */
const Telegram = (() => {
  const OPTS = [
    ['goles', '⚽ Goles de tus equipos'], ['partido', '🟢 Arranque y final de sus partidos'],
    ['canales', '🔴 Canales elegidos que salen en vivo'], ['motor', '🏁 Sesiones de automovilismo (15 min antes)'],
    ['resumenes', '🎬 Resúmenes nuevos'], ['repro', '📄 Vencimiento del REPROCANN'], ['t420', '🍃 4:20 y 16:20']
  ];
  const T = () => { db.tg = db.tg || {}; const t = db.tg; t.on = t.on || { goles:true, partido:true, canales:true, motor:true, resumenes:true, repro:true, t420:false }; t.chans = t.chans || []; t.quiet = t.quiet || { on:false, from:'00:00', to:'08:00' }; return t; };
  const api = async (m, p = {}) => {
    const r = await fetch(`https://api.telegram.org/bot${T().token}/${m}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(p) });
    const j = await r.json(); if (!j.ok) throw new Error(j.description || 'error'); return j.result;
  };
  function open() {
    const t = T();
    let d = $('dlgTg'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgTg'; document.body.appendChild(d); }
    const yt = db.chans.filter(c => ['youtube', 'twitch', 'kick'].includes(c.platform) && !c.ref.video);
    d.innerHTML = `<h3>📲 Avisos por Telegram</h3>
      <details ${t.token ? '' : 'open'}><summary style="cursor:pointer;color:var(--acc)">Cómo crear tu bot (2 minutos)</summary><ol style="font-size:13px;line-height:1.6">
        <li>En Telegram buscá <b>@BotFather</b>, mandale <code>/newbot</code>, elegí un nombre (ej: Mi FUNVS) y un usuario que termine en <code>bot</code>.</li>
        <li>Te da un <b>token</b> (algo como <code>123456:ABC…</code>). Pegalo abajo.</li>
        <li>Abrí tu bot nuevo y mandale <b>/start</b>. Después tocá <b>Detectar mi chat</b>.</li>
        <li>Para que GitHub mande los avisos, falta un paso que hacés una sola vez en GitHub: está explicado al final.</li></ol></details>
      <label>Token del bot<input id="tgTok" value="${esc(t.token || '')}" placeholder="123456:ABC..." autocomplete="off"></label>
      <div class="btns"><button id="tgDetect">🔍 Detectar mi chat</button><button id="tgTest" ${t.chat ? '' : 'disabled'}>📨 Mandar prueba</button><span class="sp"></span><span class="mut" id="tgChat" style="font-size:13px">${t.chat ? '✅ Chat conectado' + (t.name ? ': ' + esc(t.name) : '') : 'Sin chat todavía'}</span></div>
      <div class="msg" id="tgMsg"></div>
      <h4 style="margin:12px 0 6px">Qué avisar</h4>
      <div class="tgopts">${OPTS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-o="${k}" ${t.on[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <details style="margin-top:8px"><summary style="cursor:pointer;font-size:14px">🔴 Qué canales avisar cuando salen en vivo (${t.chans.length})</summary>
        <div class="tgch">${yt.map(c => `<label class="chk"><input type="checkbox" data-ch="${c.uid}" ${t.chans.includes(c.uid) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('') || '<p class="mut">No tenés canales.</p>'}</div></details>
      <label class="chk" style="margin-top:8px"><input type="checkbox" id="tgQ" ${t.quiet.on ? 'checked' : ''}> Silencio de <input type="time" id="tgQf" value="${t.quiet.from}" style="width:auto"> a <input type="time" id="tgQt" value="${t.quiet.to}" style="width:auto"> (los goles de tus equipos llegan igual)</label>
      <details style="margin-top:10px"><summary style="cursor:pointer;font-size:14px">⚙️ El paso de GitHub (una sola vez)</summary><ol style="font-size:13px;line-height:1.6">
        <li>Entrá a <a href="https://github.com/klasito7/mi-streaming/settings/secrets/actions/new" target="_blank" rel="noopener" style="color:var(--acc)">Settings → Secrets → New repository secret</a> del repo.</li>
        <li>Nombre: <code>GIST_ID</code>. Valor: el código de sincronización de FUNVS (está en ⚙ Ajustes, “Sincronizar”: la parte larga de letras y números). Guardá.</li>
        <li>Listo: GitHub lee tu configuración privada de ahí. El token y tus datos nunca quedan en el repo público.</li></ol>
        <p class="mut" style="font-size:12px">Ojo: GitHub corre los chequeos cada ~10 minutos (a veces se atrasa). Durante los partidos de tus equipos revisa cada 45 segundos.</p></details>
      <div class="btns" style="margin-top:12px"><span class="sp"></span><button id="tgX">Cerrar</button><button class="pri" id="tgOk">Guardar</button></div>`;
    d.showModal();
    const msg = (m, err) => { $('tgMsg').className = 'msg' + (err ? ' err' : ''); $('tgMsg').innerHTML = m; };
    $('tgDetect').onclick = async () => {
      t.token = $('tgTok').value.trim(); if (!t.token) return msg('Primero pegá el token.', true);
      try {
        const me = await api('getMe'); const up = await api('getUpdates', { limit:20 });
        const ch = up.map(u => u.message?.chat || u.my_chat_member?.chat).filter(Boolean).pop();
        if (!ch) return msg(`Bot <b>@${esc(me.username)}</b> OK. Ahora abrilo en Telegram, mandale <b>/start</b> y volvé a tocar “Detectar”.`);
        t.chat = ch.id; t.name = ch.first_name || ch.title || ''; t.bot = me.username; save();
        $('tgChat').textContent = '✅ Chat conectado: ' + t.name; $('tgTest').disabled = false; msg('¡Listo! Ya sé a dónde mandarte los avisos.');
      } catch (e) { msg('No funcionó: ' + esc(e.message) + '. Revisá el token.', true); }
    };
    $('tgTest').onclick = async () => { try { await api('sendMessage', { chat_id:t.chat, text:'📺 FUNVS conectado. Los avisos te van a llegar acá. ⚽🏁🎬' }); msg('Prueba enviada: fijate en Telegram.'); } catch (e) { msg('No se pudo mandar: ' + esc(e.message), true); } };
    $('tgX').onclick = () => d.close();
    $('tgOk').onclick = () => {
      t.token = $('tgTok').value.trim();
      d.querySelectorAll('[data-o]').forEach(x => t.on[x.dataset.o] = x.checked);
      t.chans = [...d.querySelectorAll('[data-ch]')].filter(x => x.checked).map(x => x.dataset.ch);
      t.quiet = { on:$('tgQ').checked, from:$('tgQf').value || '00:00', to:$('tgQt').value || '08:00' };
      save(); d.close(); toast('📲 Avisos de Telegram guardados', { ms:4000 });
    };
  }
  return { open };
})();
