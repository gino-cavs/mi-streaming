// 📍 MG News: todo de Monte Grande y Esteban Echeverría para FUNVS.
//   · noticias locales (Google Noticias + la web del Municipio)    · agenda (eventos del Municipio)
//   · estado del tren Roca según las noticias de las últimas horas · cortes de tránsito en las rutas de la zona
//   · cortes de luz de Edesur en Esteban Echeverría (ENRE)          · efemérides de la ciudad (Wikipedia, una vez por mes)
// Uso: node scripts/fetch-mg.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'Mozilla/5.0 (FUNVS uso personal; github.com/klasito7/mi-streaming)' };
const get = async (u, t = 25000) => { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(t) }); return r.ok ? r.text() : ''; } catch { return ''; } };
const dec = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;|&#8212;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function rss(x) {
  return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const g = k => dec((m[1].match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)<\\/${k}>`)) || [])[1]);
    let t = g('title'), s = g('source');
    if (!s && / - [^-]+$/.test(t)) { s = t.replace(/^.* - /, ''); }
    t = t.replace(/ - [^-]+$/, '');
    return { t, s, l:g('link'), d:new Date(g('pubDate') || Date.now()).toISOString(), desc:g('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 280) };
  });
}
const gnews = q => get(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=AR&ceid=AR:es-419`).then(rss);
const fresh = (l, h) => l.filter(i => Date.now() - Date.parse(i.d) < h * 3600e3);
const uniq = l => { const seen = new Set(); return l.filter(i => { const k = norm(i.t).slice(0, 60); return !seen.has(k) && seen.add(k); }); };

// --- noticias locales ---
const LOCAL = ['"Monte Grande"', '"Esteban Echeverría"', '"Luis Guillón"', '"El Jagüel"', '"9 de Abril" Echeverría'];
let noticias = (await Promise.all(LOCAL.map(q => gnews(q + ' when:7d')))).flat();
const muni = rss(await get('https://www.estebanecheverria.gob.ar/feed/')).map(i => ({ ...i, s:'Municipio', muni:true }));
const caps = t => { const up = (t.match(/[A-ZÁÉÍÓÚÑÜ]/g) || []).length, lo = (t.match(/[a-záéíóúñü]/g) || []).length; if (up <= lo) return t;
  let x = t.toLowerCase(); x = x.charAt(0).toUpperCase() + x.slice(1);
  for (const n of ['Monte Grande', 'Esteban Echeverría', 'Echeverría', 'Fernando Gray', 'Gray', 'Luis Guillón', 'El Jagüel', 'Canning', 'Santa Catalina', 'Papa']) x = x.split(n.toLowerCase()).join(n);
  return x; };
const lugar = /monte grande|guill[oó]n|jag[uü]el|9 de abril|canning/i, partido = /esteban echeverr[ií]a/i, contexto = /(municipio|intendente|gray|distrito|vecin|partido de|comisar|polic|hospital|barrio|calle|escuela n|concejo)/i;
noticias = uniq([...noticias, ...muni]).filter(i => Date.now() - Date.parse(i.d) < 7 * 864e5)
  .map(i => ({ ...i, t:caps(i.t), s:/^https?:/.test(i.s) ? new URL(i.s).hostname.replace(/^www\./, '') : i.s.replace(/^Esteban Echeverr[ií]a – Municipio$/, 'Municipio') }))
  .filter(i => i.muni || i.s === 'Municipio' || lugar.test(i.t) || (partido.test(i.t) && contexto.test(i.t + ' ' + i.desc)))
  .filter(i => !/santa fe|rosario|c[oó]rdoba|paran[aá]|el matadero|la cautiva/i.test(i.t))
  .sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, 40);

// --- agenda: lo del Municipio que suena a evento ---
const agenda = uniq(muni.map(i => ({ ...i, t:caps(i.t) }))).filter(i => /(feria|festival|expo|show|concierto|recital|muestra|taller|torneo|marat[oó]n|carrera|fiesta|celebraci|encuentro|jornada|cine|teatro|vacunaci|operativo|inscripci)/i.test(i.t)).slice(0, 10);

// --- tren Roca según las noticias (últimas 6 h; prioriza ramal Ezeiza) ---
const roca = fresh(uniq([...(await gnews('"línea Roca" when:1d')), ...(await gnews('"tren Roca" when:1d'))]), 8)
  .filter(i => /roca/i.test(i.t)).sort((a, b) => Date.parse(b.d) - Date.parse(a.d));
const mala = /(demora|limitad|interrump|suspend|paro|corte|sin servicio|cancelad|colisi|falla|medida de fuerza)/i, buena = /(normal|habitual|restablec|reanuda|normaliza)/i;
const ez = roca.filter(i => /ezeiza|monte grande|guill[oó]n|jag[uü]el|todos los ramales|toda la l[ií]nea|l[ií]nea roca/i.test(i.t + ' ' + i.desc));
const top = ez[0] || null;
const trenRoca = top ? { estado:mala.test(top.t) && !buena.test(top.t) ? 'mal' : buena.test(top.t) ? 'ok' : 'info', t:top.t, s:top.s, d:top.d, l:top.l } : { estado:'sin-novedad' };

// --- tránsito y cortes en las rutas de la zona (últimas 24 h) ---
const transito = fresh(uniq((await Promise.all(['"Camino de Cintura" corte', '"ruta 205" corte', 'autopista Ezeiza Cañuelas corte', '"Monte Grande" corte tránsito', 'Esteban Echeverría piquete'].map(q => gnews(q + ' when:1d')))).flat()), 24)
  .filter(i => /(corte|piquete|tr[aá]nsito|choque|accidente|demora|obra|desv[ií]o|manifestaci)/i.test(i.t)).sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, 8);

// --- camino a la cancha de Vélez (Monte Grande → Liniers): Camino Negro, Riccheri, General Paz y cortes en Liniers (últimas 6 h) ---
const ROUTES = [['Camino Negro', '"Camino Negro"'], ['Riccheri', '"autopista Riccheri" OR "Riccheri"'], ['General Paz', '"General Paz" tránsito OR corte OR choque'], ['Liniers', 'Liniers corte OR piquete OR tránsito']];
const cancha = [];
for (const [k, q] of ROUTES) {
  const L = fresh(uniq(await gnews(q + ' when:1d')), 6).filter(i => /(corte|piquete|tr[aá]nsito|choque|accidente|demora|obra|desv[ií]o|manifestaci|congesti|embotell|cerrad)/i.test(i.t))
    .sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, 2);
  cancha.push({ k, items:L });
}

// --- cortes de luz de Edesur en Esteban Echeverría (ENRE) ---
let luz = { ok:false };
try {
  const js = await get('https://www.enre.gov.ar/paginacorte/js/data_EDS.js');
  const lst = k => { const m = js.match(new RegExp(k + ':\\s*(\\[[\\s\\S]*?\\])\\s*,\\s*\\n')); if (!m) return []; try { return Function('return ' + m[1])(); } catch { return []; } };
  const mine = l => l.filter(x => /ECHEVERRIA/i.test(norm(x.partido).toUpperCase())).map(x => ({ loc:x.localidad, usuarios:+String(x.usuarios).replace(/\./g, ''), hasta:x.normalizacion }));
  const act = (js.match(/ultimaActualizacion:\s*'([^']+)'/) || [])[1];
  luz = { ok:!!js, act, programados:mine(lst('cortesProgramados')), media:mine(lst('cortesServicioMedia')), baja:mine(lst('cortesServicioBaja')), preventivos:mine(lst('cortesPreventivos')) };
} catch {}

// --- efemérides de la ciudad (Wikipedia: frases con fecha completa), una vez por mes ---
let efem = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/mg.json?t=${Date.now()}`); if (r.ok) { const p = await r.json(); if (p.efem && Date.now() - Date.parse(p.efemAt || 0) < 30 * 864e5) efem = { dias:p.efem, at:p.efemAt }; } } catch {}
if (!efem) {
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dias = {};
  for (const page of ['Monte Grande (Buenos Aires)', 'Partido de Esteban Echeverría', 'Luis Guillón', 'El Jagüel', 'Estación Monte Grande', 'Colonia escocesa de Monte Grande', 'Canning (Buenos Aires)']) {
    const j = JSON.parse(await get(`https://es.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(page)}`) || '{}');
    const txt = Object.values(j.query?.pages || {})[0]?.extract || '';
    for (const sent of txt.replace(/\n+/g, ' ').split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/)) {
      for (const m of sent.matchAll(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre) de (1[6-9]\d\d|20[0-2]\d)\b/gi)) {
        const mo = MES.indexOf(m[2].toLowerCase().replace('setiembre', 'septiembre')) + 1, k = String(mo).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
        const t = sent.trim().replace(/\s*\[\d+\]/g, ''); if (t.length < 25 || t.length > 320 || /consultado|archivado|recuperado|\(\d{1,2} de \w+ de \d{4}\)|«|isbn|p\. \d/i.test(t) || +m[3] >= new Date().getFullYear()) continue;
        (dias[k] = dias[k] || []); if (!dias[k].some(x => x.t === t)) dias[k].push({ y:+m[3], t, p:page });
      }
    }
  }
  efem = { dias, at:new Date().toISOString() };
}

await writeFile(dir + '/mg.json', JSON.stringify({ updated:new Date().toISOString(), noticias, agenda, trenRoca, transito, cancha, luz, efem:efem.dias, efemAt:efem.at }));
console.log(`MG News: ${noticias.length} noticias · agenda ${agenda.length} · Roca ${trenRoca.estado} · tránsito ${transito.length} · luz ${luz.ok ? (luz.programados.length + luz.media.length + luz.baja.length) + ' cortes' : 'sin datos'} · efemérides ${Object.keys(efem.dias).length} días`);
