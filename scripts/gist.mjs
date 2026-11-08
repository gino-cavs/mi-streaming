// Lee la configuración de FUNVS desde el Gist privado de sincronización (secreto GIST_ID).
// Nunca imprime su contenido: tiene claves (YouTube, Telegram).
export async function readDb() {
  const id = process.env.GIST_ID; if (!id) return null;
  const h = { Accept:'application/vnd.github+json', 'User-Agent':'mi-streaming' };
  if (process.env.GH_TOKEN) h.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  try {
    let g = await (await fetch('https://api.github.com/gists/' + id, { headers:h })).json();
    if (!g.files && h.Authorization) { delete h.Authorization; g = await (await fetch('https://api.github.com/gists/' + id, { headers:h })).json(); }
    const f = g.files?.['mi-streaming.json']; if (!f) { console.log('No encontré la configuración en el Gist (¿GIST_ID correcto?)'); return null; }
    return JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
  } catch (e) { console.log('No pude leer el Gist:', e.message); return null; }
}
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
