/* =========================================================
   👍 Me gusta de verdad en YouTube (con tu cuenta), para bancar a los programas.
   Usa el inicio de sesión oficial de Google (sin contraseñas): el permiso dura 1 hora
   y se renueva solo cuando hace falta. Nada se guarda fuera de este navegador.
   ========================================================= */
const Likes = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
  let token = null, exp = 0, client = null, pending = [];
  const rated = {};            // videoId -> 'like' | 'none'
  const ready = () => !!(db.oauth && db.oauth.clientId);

  async function getToken(interactive) {
    if (token && Date.now() < exp - 60e3) return token;
    if (!ready()) throw new Error('setup');
    await loadScript('https://accounts.google.com/gsi/client');
    if (!client) client = google.accounts.oauth2.initTokenClient({ client_id:db.oauth.clientId, scope:SCOPE, callback:() => {} });
    return new Promise((res, rej) => {
      client.callback = r => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        token = r.access_token; exp = Date.now() + (+r.expires_in || 3600) * 1000;
        try { sessionStorage.setItem('ytTok', JSON.stringify({ token, exp })); } catch {}
        paintAll(); res(token);
      };
      client.error_callback = e => rej(new Error(e && e.type === 'popup_closed' ? 'Cerraste la ventana de Google.' : 'No se pudo iniciar sesión con Google.'));
      client.requestAccessToken({ prompt:interactive ? 'consent' : '' });
    });
  }
  async function api(path, opts = {}) {
    const t = await getToken(false);
    const r = await fetch('https://www.googleapis.com/youtube/v3/' + path, { ...opts, headers:{ Authorization:'Bearer ' + t } });
    if (r.status === 401) { token = null; return api(path, opts); }
    if (!r.ok && r.status !== 204) { let m = ''; try { m = (await r.json()).error.message; } catch {} throw new Error(m || 'YouTube respondió con error ' + r.status); }
    return r.status === 204 ? null : r.json();
  }
  async function status(vid) {
    if (!vid || !token || rated[vid]) return rated[vid];
    try { const j = await api('videos/getRating?id=' + vid); rated[vid] = j.items?.[0]?.rating || 'none'; paintAll(); } catch {}
    return rated[vid];
  }
  // botón: da o saca el like
  async function toggle(vid, name) {
    if (!vid) return;
    if (!ready()) { openSetup(vid); return; }
    try {
      const now = rated[vid] === 'like' ? 'none' : 'like';
      await api(`videos/rate?id=${vid}&rating=${now}`, { method:'POST' });
      rated[vid] = now; paintAll();
      toast(now === 'like' ? `<b>👍 Le diste like</b><small>${esc(name || '')} — ¡aguante bancar!</small>` : `<b>Sacaste el like</b><small>${esc(name || '')}</small>`, { cls:'info', ms:3500 });
    } catch (e) {
      if (e.message === 'setup') return openSetup(vid);
      toast(`<b>No pude dar el like</b><small>${esc(e.message)}</small>`, { cls:'info', ms:6000 });
    }
  }
  const btn = (vid, name, cls = '') => vid ? `<button class="likebtn ${cls} ${rated[vid] === 'like' ? 'on' : ''}" data-like="${esc(vid)}" data-name="${esc(name || '')}" title="${rated[vid] === 'like' ? 'Sacar el me gusta' : 'Me gusta en YouTube (banca al programa)'}">👍 ${rated[vid] === 'like' ? 'Te gusta' : 'Me gusta'}</button>` : '';
  function paintAll() {
    document.querySelectorAll('[data-like]').forEach(b => {
      const on = rated[b.dataset.like] === 'like';
      b.classList.toggle('on', on); b.textContent = '👍 ' + (on ? 'Te gusta' : 'Me gusta');
    });
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-like]'); if (b) { e.stopPropagation(); toggle(b.dataset.like, b.dataset.name); } }, true);

  /* ---------- Configuración (una sola vez) ---------- */
  function openSetup(vid) {
    $('lkClient').value = (db.oauth && db.oauth.clientId) || '';
    $('lkOrigin').textContent = location.origin;
    $('lkOpen').href = vid ? 'https://www.youtube.com/watch?v=' + vid : 'https://www.youtube.com';
    $('lkMsg').textContent = '';
    $('dlgLike').showModal();
  }
  function init() {
    try { const t = JSON.parse(sessionStorage.getItem('ytTok') || 'null'); if (t && t.exp > Date.now()) { token = t.token; exp = t.exp; } } catch {}
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="dlgLike"><h3>👍 Conectar tu cuenta de YouTube para dar Me gusta</h3>
        <p>YouTube no deja dar like desde un video incrustado en otra página. Para hacerlo desde FUNVS, Google tiene que darle permiso a tu página. Se hace una sola vez (unos 5 minutos), en el mismo proyecto donde sacaste la clave de YouTube:</p>
        <ol>
          <li>En <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener" style="color:var(--acc)">Google Cloud → Google Auth Platform</a>, tocá <b>Comenzar</b>: nombre de la app "FUNVS", tu Gmail, público <b>Externo</b>.</li>
          <li>En <b>Público</b>, agregá tu Gmail como <b>usuario de prueba</b>.</li>
          <li>En <b>Clientes</b> → <b>Crear cliente</b> → tipo <b>Aplicación web</b>. En "Orígenes autorizados de JavaScript" poné: <b id="lkOrigin"></b></li>
          <li>Copiá el <b>ID de cliente</b> (termina en <i>.apps.googleusercontent.com</i>) y pegalo acá:</li>
        </ol>
        <input id="lkClient" placeholder="123456-abc.apps.googleusercontent.com">
        <p style="margin-top:6px">La primera vez Google te va a avisar que la app "no está verificada": es normal porque la usás solo vos. Tocá <b>Continuar</b>. El permiso dura una hora y se renueva solo.</p>
        <div class="msg" id="lkMsg"></div>
        <div class="btns"><a id="lkOpen" class="sm lnk" target="_blank" rel="noopener" style="text-decoration:none;align-self:center">Por ahora, dar like en YouTube ↗</a><span class="sp"></span>
          <button data-close>Cerrar</button><button class="pri" id="lkSave">Guardar y conectar</button></div></dialog>`);
    $('dlgLike').querySelector('[data-close]').onclick = () => $('dlgLike').close();
    $('lkSave').onclick = async () => {
      const id = $('lkClient').value.trim(), m = $('lkMsg');
      if (!/\.apps\.googleusercontent\.com$/.test(id)) { m.className = 'msg err'; m.textContent = 'Ese no parece un ID de cliente de Google (termina en .apps.googleusercontent.com).'; return; }
      db.oauth = { clientId:id }; client = null; save();
      m.className = 'msg'; m.textContent = 'Abriendo Google…';
      try { await getToken(true); m.className = 'msg ok'; m.textContent = '¡Conectado! Ya podés dar Me gusta desde FUNVS.'; setTimeout(() => $('dlgLike').close(), 1200); }
      catch (e) { m.className = 'msg err'; m.textContent = e.message + ' Revisá que el origen autorizado sea exactamente ' + location.origin + ' y que tu Gmail esté como usuario de prueba.'; }
    };
  }
  return { init, btn, status, openSetup, get connected() { return !!token; }, get ready() { return ready(); } };
})();
