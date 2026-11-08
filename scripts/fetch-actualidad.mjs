// 🔥 Actualidad: los temas que cubren todos los medios (visita del Papa, una marcha enorme, la muerte de un famoso…).
// Toma la portada de Google Noticias (Argentina y mundo), junta las notas del mismo tema, cuenta cuántos medios
// distintos lo cubren (con las ~1600 noticias de news.json) y cuánto tiempo sigue en tapa. Guarda historia de 45 días.
// Uso: node scripts/fetch-actualidad.mjs carpeta_salida [usuario/repo]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const LOC = 'hl=es-419&gl=AR&ceid=AR:es-419';
const FEEDS = [['ar', `https://news.google.com/rss?${LOC}`], ['mundo', `https://news.google.com/rss/headlines/section/topic/WORLD?${LOC}`], ['ar2', `https://news.google.com/rss/headlines/section/topic/NATION?${LOC}`]];
const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m).trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ''; };
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('de la el los las un una unos unas y o a en con por para del al que se su sus lo le les es son fue ser como mas pero sin sobre tras ante entre hasta desde este esta estos estas ese esa eso hay muy ya no si ni todo todos tambien cual cuando donde quien despues antes durante contra segun hoy ayer manana anos ano tras dijo dice nuevo nueva gran grandes vivo minuto video fotos asi que'.split(' '));
const words = t => new Set(norm(t).split(' ').filter(w => w.length > 3 && !STOP.has(w)));
const sim = (A, B) => { let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.max(1, Math.min(A.size, B.size)); };
const ICON = [[/muri[oó]|falleci[oó]|muerte de|adi[oó]s a|velorio|q\.?e\.?p\.?d/i, '🕊️'], [/papa|le[oó]n xiv|vaticano|pont[ií]fice/i, '⛪'], [/marcha|movilizaci|paro general|protesta|cacerolazo/i, '✊'],
  [/elecci|votaci|balotaje|escrutinio/i, '🗳️'], [/terremoto|sismo|inundaci|tormenta|alerta|incendio|tragedia|accidente|choque/i, '⚠️'], [/selecci[oó]n|mundial|scaloni|messi|final|campe[oó]n/i, '🏆'],
  [/d[oó]lar|inflaci|econom|fmi|bcra|tarifa/i, '💵'], [/guerra|ataque|bombardeo|misil/i, '💥']];
const iconOf = t => (ICON.find(([re]) => re.test(t)) || [, '📰'])[1];

// historia previa
let prev = { topics:[] };
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/actualidad.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
const topics = (prev.topics || []).filter(t => Date.now() - Date.parse(t.last) < 45 * 864e5).map(t => ({ ...t, W:words(t.t + ' ' + (t.alt || []).join(' ')) }));

// todas las noticias juntadas en esta corrida (para contar medios)
let news = [];
try { news = JSON.parse(await readFile(dir + '/news.json', 'utf8')).items || []; } catch { try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/news.json`); news = (await r.json()).items || []; } catch {} }
const recent = news.filter(i => Date.now() - Date.parse(i.d) < 36 * 3600e3).map(i => ({ ...i, W:words(i.t) }));

const now = new Date().toISOString(), seenNow = new Set();
for (const [feed, url] of FEEDS) {
  let xml = '';
  try { const r = await fetch(url, { headers:{ 'User-Agent':'Mozilla/5.0 (FUNVS actualidad)' } }); xml = r.ok ? await r.text() : ''; } catch {}
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 30);
  items.forEach(([, x], pos) => {
    const src = tag(x, 'source'); let t = tag(x, 'title'); if (src && t.endsWith(' - ' + src)) t = t.slice(0, -(src.length + 3));
    const desc = tag(x, 'description');
    const related = [...desc.matchAll(/<a [^>]*>([^<]+)<\/a>(?:&nbsp;|\s)*<font[^>]*>([^<]+)<\/font>/g)].map(m => [decode(m[1]), decode(m[2])]);
    const W = words(t + ' ' + related.map(r => r[0]).join(' '));
    if (W.size < 2) return;
    // medios distintos que hablan de esto
    const tw = words(t), cover = new Set([src, ...related.map(r => r[1])].filter(Boolean));
    for (const n of recent) if (n.s && sim(tw, n.W) >= 0.5 && [...tw].filter(w => n.W.has(w)).length >= 2) cover.add(n.s);
    let tp = topics.find(z => sim(words(t), z.W) >= 0.45 || sim(W, z.W) >= 0.5);
    if (!tp) { tp = { id:'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t, l:tag(x, 'link'), first:now, runs:0, best:99, n:0, ic:iconOf(t), feed, alt:[] }; topics.push(tp); }
    if (seenNow.has(tp.id)) { tp.n = Math.max(tp.n, cover.size); return; }
    seenNow.add(tp.id);
    tp.last = now; tp.runs++; tp.best = Math.min(tp.best, pos + 1); tp.pos = pos + 1;
    if (cover.size >= tp.n) { tp.t = t; tp.l = tag(x, 'link'); tp.s = src; }   // el titular de cuando más se habló
    tp.n = Math.max(tp.n, cover.size); tp.now = cover.size; tp.medios = [...cover].slice(0, 12);
    tp.alt = [...new Set([...(tp.alt || []), ...related.map(r => r[0])])].slice(-8);
    tp.W = words(tp.t + ' ' + tp.alt.join(' '));
    if (tp.ic === '📰') tp.ic = iconOf(t + ' ' + related.map(r => r[0]).join(' '));
  });
}
// importancia: cuántos medios + qué tan arriba estuvo + cuánto duró en tapa (cada corrida = 30 min)
for (const t of topics) { t.horas = Math.round(t.runs / 2 * 10) / 10; t.score = Math.round(t.n * 3 + Math.max(0, 12 - t.best) * 2 + Math.min(t.horas, 48)); t.big = t.n >= 8 || (t.n >= 5 && t.horas >= 6 && t.best <= 5); }
const out = topics.map(({ W, ...t }) => t);
const ahora = out.filter(t => seenNow.has(t.id)).sort((a, b) => b.score - a.score).slice(0, 15).map(t => t.id);
await writeFile(dir + '/actualidad.json', JSON.stringify({ updated:now, ahora, topics:out.sort((a, b) => Date.parse(b.last) - Date.parse(a.last)).slice(0, 400) }));
console.log(`Actualidad: ${ahora.length} temas ahora · ${out.filter(t => t.big).length} grandes en 45 días · top: ${out.filter(t => ahora.includes(t.id)).slice(0, 3).map(t => `${t.ic} ${t.t.slice(0, 50)} (${t.n} medios)`).join(' | ')}`);
