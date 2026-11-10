// 📺 Novelas argentinas: para cada novela del catálogo busca en YouTube las playlists de capítulos
// subidas por los canales OFICIALES (eltrece, Telefe, Pol-ka, América, etc.). Las que no están oficialmente
// quedan marcadas así (FUNVS no carga subidas de terceros). Corre una vez por mes (o si cambia el catálogo).
// Uso: node scripts/fetch-novelas.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const CAT = [
  // [título, año, canal original, productora]
  ['Gasoleros', 1998, 'eltrece', 'Pol-ka'], ['Campeones de la vida', 1999, 'eltrece', 'Pol-ka'], ['Primicias', 2000, 'eltrece', 'Pol-ka'],
  ['099 Central', 2002, 'eltrece', 'Pol-ka'], ['Son amores', 2002, 'eltrece', 'Pol-ka'], ['Soy gitano', 2003, 'eltrece', 'Pol-ka'],
  ['Padre Coraje', 2004, 'eltrece', 'Pol-ka'], ['Sin código', 2004, 'eltrece', 'Pol-ka'], ['Hombres de honor', 2005, 'eltrece', 'Pol-ka'],
  ['Collar de esmeraldas', 2006, 'eltrece', 'Pol-ka'], ['Son de Fierro', 2007, 'eltrece', 'Pol-ka'], ['Valientes', 2009, 'eltrece', 'Pol-ka'],
  ['Malparida', 2010, 'eltrece', 'Pol-ka'], ['Herederos de una venganza', 2011, 'eltrece', 'Pol-ka'], ['Los Únicos', 2011, 'eltrece', 'Pol-ka'],
  ['Sos mi hombre', 2012, 'eltrece', 'Pol-ka'], ['Farsantes', 2013, 'eltrece', 'Pol-ka'], ['Guapas', 2014, 'eltrece', 'Pol-ka'],
  ['Mis amigos de siempre', 2014, 'eltrece', 'Pol-ka'], ['Esperanza mía', 2015, 'eltrece', 'Pol-ka'], ['Los ricos no piden permiso', 2016, 'eltrece', 'Pol-ka'],
  ['Floricienta', 2004, 'eltrece', 'Cris Morena'], ['Patito feo', 2007, 'eltrece', 'Ideas del Sur'], ['Enseñame a vivir', 2009, 'eltrece', 'Ideas del Sur'],
  ['Muñeca brava', 1998, 'Telefe', 'Telefe'], ['Chiquititas', 1995, 'Telefe', 'Cris Morena'], ['Rebelde Way', 2002, 'América', 'Cris Morena'],
  ['Resistiré', 2003, 'Telefe', 'Telefe'], ['Amor en custodia', 2005, 'Telefe', 'Telefe'], ['Montecristo', 2006, 'Telefe', 'Telefe'],
  ['Casi Ángeles', 2007, 'Telefe', 'Cris Morena'], ['Lalola', 2007, 'América', 'Dori Media'], ['Los exitosos Pells', 2008, 'Telefe', 'Underground'],
  ['Botineras', 2009, 'Telefe', 'Underground'], ['El elegido', 2011, 'Telefe', 'Telefe'], ['Graduados', 2012, 'Telefe', 'Underground'],
  ['Dulce amor', 2012, 'Telefe', 'LC Acción'], ['Somos familia', 2014, 'Telefe', 'Telefe'], ['Educando a Nina', 2016, 'Telefe', 'Telefe'],
];
const OFICIAL = /^(eltrece|el trece|telefe|pol-?ka|polka producciones|am[eé]rica tv|underground|cris morena|ideas del sur|lc acci[oó]n|dori media|canal 13|artear|viacom|televisi[oó]n p[uú]blica)/i;
const key = process.env.YT_KEY;
const prev = await fetch(`https://raw.githubusercontent.com/${repo}/datos/novelas.json?t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null);
const sameCat = prev?.cat === CAT.length;
if (prev && sameCat && Date.now() - Date.parse(prev.updated) < 30 * 864e5) { await writeFile(dir + '/novelas.json', JSON.stringify(prev)); console.log('Novelas: reuso las del mes'); process.exit(0); }
if (!key) { if (prev) await writeFile(dir + '/novelas.json', JSON.stringify(prev)); console.log('Novelas: falta YT_KEY'); process.exit(0); }
const yt = async (path, p) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + path); Object.entries({ ...p, key }).forEach(([k, v]) => u.searchParams.set(k, v)); return (await fetch(u)).json(); };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const out = [];
for (const [t, y, canal, prod] of CAT) {
  const r = await yt('search', { part:'snippet', type:'playlist', maxResults:15, q:`${t} capítulos completos`, regionCode:'AR', relevanceLanguage:'es' });
  if (r.error) { console.log('YouTube:', r.error.message); break; }
  const nt = norm(t);
  const cand = (r.items || []).filter(x => norm(x.snippet.title).includes(nt) && OFICIAL.test(x.snippet.channelTitle))
    .map(x => ({ id:x.id.playlistId, t:x.snippet.title, ch:x.snippet.channelTitle, img:x.snippet.thumbnails?.medium?.url || '' }));
  if (cand.length) {   // cuántos videos tiene cada una (para descartar las de clips sueltos)
    const d = await yt('playlists', { part:'contentDetails', id:cand.map(c => c.id).join(','), maxResults:50 });
    const n = Object.fromEntries((d.items || []).map(x => [x.id, x.contentDetails.itemCount]));
    cand.forEach(c => c.n = n[c.id] || 0);
  }
  const ops = cand.filter(c => c.n >= 5).sort((a, b) => /cap[ií]tulo|completo|episodio/i.test(b.t) - /cap[ií]tulo|completo|episodio/i.test(a.t) || b.n - a.n).slice(0, 4);
  out.push({ t, y, canal, prod, ops });
}
await writeFile(dir + '/novelas.json', JSON.stringify({ updated:new Date().toISOString(), cat:CAT.length, novelas:out }));
console.log(`Novelas: ${out.filter(n => n.ops.length).length}/${out.length} con playlists oficiales`);
