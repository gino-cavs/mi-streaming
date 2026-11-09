// 🗓 Grilla desde tu calendario: leo el link iCal secreto que guardaste en FUNVS (Ajustes) y paso los eventos a la guía.
// Cada evento se llama "Canal | Programa" (también vale "Canal: Programa" o "Canal - Programa").
// Los repetidos semanales (Google Calendar: "Se repite cada semana…") quedan como grilla fija; los sueltos, solo ese día.
// El link NO se publica: solo sale la grilla (datos/grillacal.json).
// Uso: node scripts/fetch-grillacal.mjs carpeta_salida
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb, norm } from './gist.mjs';
const dir = process.argv[2] || '.';
await mkdir(dir, { recursive:true });
const db = await readDb().catch(() => null);
const url = db?.grillaIcal;
if (!url) { await writeFile(dir + '/grillacal.json', JSON.stringify({ updated:new Date().toISOString(), canales:[] })); console.log('Grilla calendario: sin link'); process.exit(0); }
const r = await fetch(url.replace(/^webcal:/, 'https:'), { headers:{ 'User-Agent':'FUNVS/1.0 (uso personal)' }, signal:AbortSignal.timeout(30000) });
if (!r.ok) { console.log('Grilla calendario: el calendario respondió', r.status); process.exit(0); }
const ics = (await r.text()).replace(/\r?\n[ \t]/g, '');   // líneas plegadas

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], BY = { SU:'sun', MO:'mon', TU:'tue', WE:'wed', TH:'thu', FR:'fri', SA:'sat' };
const AR = -3 * 3600e3;   // hora de Argentina (sin horario de verano)
// fecha del ICS → { ymd, hm, dw } en hora de Argentina
function when(line) {
  if (!line) return null;
  const [k, v] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()];
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null;
  if (!m[4]) return { ymd:`${m[1]}-${m[2]}-${m[3]}`, hm:null, allDay:true };
  let t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  const tz = (k.match(/TZID=([^;:]+)/) || [])[1] || '';
  if (m[7]) t += AR;                                              // en UTC → paso a Argentina
  else if (tz && !/Argentina|Buenos_Aires|Montevideo|Sao_Paulo/i.test(tz)) {
    try { const off = new Date(new Date(t).toLocaleString('en-US', { timeZone:tz })) - new Date(new Date(t).toLocaleString('en-US', { timeZone:'UTC' })); t = t - off + AR; } catch {}
  }
  const d = new Date(t);
  return { ymd:d.toISOString().slice(0, 10), hm:d.toISOString().slice(11, 16), dw:DOW[d.getUTCDay()], t };
}
const chans = new Map(), now = Date.now();
for (const ev of ics.split('BEGIN:VEVENT').slice(1)) {
  const body = ev.split('END:VEVENT')[0], get = k => (body.match(new RegExp('^' + k + '[;:].*$', 'm')) || [])[0];
  if (/^STATUS:CANCELLED/m.test(body) || /^RECURRENCE-ID/m.test(body)) continue;
  const sum = (get('SUMMARY') || '').replace(/^SUMMARY[^:]*:/, '').replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
  const mm = sum.match(/^(.+?)\s*(?:\||:|\s-\s)\s*(.+)$/); if (!mm) continue;
  const [, canal, prog] = mm;
  const s = when(get('DTSTART')), e = when(get('DTEND')); if (!s || s.allDay) continue;
  let en = e?.hm || '';
  const dur = (get('DURATION') || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/); if (!en && dur) { const d = new Date(s.t + ((+dur[1] || 0) * 60 + (+dur[2] || 0)) * 6e4); en = d.toISOString().slice(11, 16); }
  const desc = (get('DESCRIPTION') || '').replace(/^DESCRIPTION[^:]*:/, '').replace(/\\n/g, '\n').replace(/\\,/g, ',');
  const pan = (desc.match(/^(?:conductores?|conducen?|con)\s*:?\s*(.+)$/im) || [])[1]?.split(/,| y /).map(x => x.trim()).filter(Boolean) || [];
  const rr = (get('RRULE') || '').replace(/^RRULE:/, '');
  const c = chans.get(norm(canal)) || { n:canal.trim(), sch:[] }; chans.set(norm(canal), c);
  if (/FREQ=WEEKLY/.test(rr) || /FREQ=DAILY/.test(rr)) {
    const until = (rr.match(/UNTIL=(\d{8})/) || [])[1]; if (until && Date.parse(until.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) < now - 864e5) continue;
    const days = /FREQ=DAILY/.test(rr) ? DOW : ((rr.match(/BYDAY=([A-Z,]+)/) || [])[1]?.split(',').map(x => BY[x.slice(-2)]) || [s.dw]);
    days.forEach(dw => c.sch.push([dw, s.hm, en, prog.trim(), pan]));
  } else if (s.t > now - 2 * 864e5 && s.t < now + 30 * 864e5) c.sch.push([s.dw, s.hm, en, prog.trim(), pan, s.ymd]);   // suelto: solo ese día
}
const canales = [...chans.values()].filter(c => c.sch.length).map(c => ({ id:'cal-' + norm(c.n).replace(/ /g, '-'), n:c.n, alias:[norm(c.n)], cats:['Mi calendario'], cal:true, sch:c.sch }));
await writeFile(dir + '/grillacal.json', JSON.stringify({ updated:new Date().toISOString(), canales }));
console.log(`Grilla calendario: ${canales.length} canales · ${canales.reduce((a, c) => a + c.sch.length, 0)} programas`);
