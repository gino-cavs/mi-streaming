// Lee la configuración de FUNVS desde el Gist privado de sincronización (secreto GIST_ID).
// Nunca imprime su contenido: tiene claves (YouTube, Telegram).
export async function readDb() {
  let id = (process.env.GIST_ID || '').trim(); if (!id) return null;
  const h = { Accept:'application/vnd.github+json', 'User-Agent':'mi-streaming' };
  // Si en el secreto quedó el TOKEN de sincronización (ghp_… / github_pat_…) en vez del código del Gist,
  // lo uso para encontrar el Gist de FUNVS. Nunca se imprime.
  const m = id.match(/[0-9a-f]{20,40}/);
  if (m && /^[0-9a-f]+$/.test(m[0]) && !/^(ghp_|github_pat_|gho_)/.test(id)) id = m[0];
  else try {
    const gs = await (await fetch('https://api.github.com/gists?per_page=100', { headers:{ ...h, Authorization:'Bearer ' + id } })).json();
    const g = Array.isArray(gs) && gs.find(x => x.files?.['mi-streaming.json']);
    if (!g) { console.log('El secreto GIST_ID no es un código de Gist válido (ni un token que lo encuentre)'); return null; }
    id = g.id; h.Authorization = 'Bearer ' + (process.env.GIST_ID || '').trim();   // con tu token: sin el límite de pedidos anónimos
  } catch { return null; }
  if (process.env.GH_TOKEN && !h.Authorization) h.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  try {
    let g = await (await fetch('https://api.github.com/gists/' + id, { headers:h })).json();
    if (!g.files && h.Authorization) { delete h.Authorization; g = await (await fetch('https://api.github.com/gists/' + id, { headers:h })).json(); }
    const f = g.files?.['mi-streaming.json']; if (!f) { console.log('No encontré la configuración en el Gist (¿GIST_ID correcto?)'); return null; }
    return JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
  } catch (e) { console.log('No pude leer el Gist:', e.message); return null; }
}
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
