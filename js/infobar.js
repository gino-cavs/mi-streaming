/* =========================================================
   ℹ️ Barra "Ahora / A continuación" (como la de un deco): al cambiar de canal o de radio
   aparece unos segundos con número, logo, el programa de ahora (con cuánto va) y el que sigue.
   ========================================================= */
const InfoBar = (() => {
  let t = null;
  const hm = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  function show({ num = '', logo = '', name = '', live = '', now, next, radio = false }) {
    let el = $('infobar'); if (!el) { el = document.createElement('div'); el.id = 'infobar'; document.body.appendChild(el); }
    const pct = now ? Math.max(0, Math.min(100, (Date.now() - now.s) / (now.e - now.s) * 100)) : 0;
    el.innerHTML = `<div class="ib-ch">${num ? `<b class="ib-num">${esc(num)}</b>` : ''}<span class="ib-logo" style="${logo ? `background-image:url('${esc(logo)}')` : ''}">${logo ? '' : radio ? '📻' : '📺'}</span><span class="ib-name">${esc(name)}</span></div>
      <div class="ib-now"><small>AHORA ${now ? `· ${hm(now.s)}–${hm(now.e)}` : ''}</small><b>${esc(now?.name || live || 'Sin programación cargada')}</b>${now && live && live !== now.name ? `<em>${esc(live)}</em>` : ''}${now ? `<i class="ib-bar"><i style="width:${pct}%"></i></i>` : ''}</div>
      ${next ? `<div class="ib-next"><small>A CONTINUACIÓN · ${hm(next.s)}</small><b>${esc(next.name)}</b></div>` : ''}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(t); t = setTimeout(() => el.classList.remove('on'), 6000);
  }
  function forChannel(c) {
    if (!c || c.t247 || c.uid === 'fortin' || /^(retro_|sv_|res_|v_)/.test(c.uid)) return;
    Guia.load(); const nn = (() => { try { return Guia.nowNext(c); } catch { return {}; } })(), st = Canales.status[c.uid] || {};
    show({ num:Canales.numTxt(c), logo:c.avatar || Guia.match(c)?.logo, name:c.name, live:st.st === 'live' ? st.title : '', now:nn.now, next:nn.next });
  }
  function forRadio(r) { const nn = (() => { try { return RadioGrilla.nowNext(r); } catch { return {}; } })(), g = RadioGrilla.match(r); show({ num:g?.dial || '', logo:r.logo, name:g?.n || r.name, now:nn.now, next:nn.next, radio:true }); }
  return { show, forChannel, forRadio };
})();
