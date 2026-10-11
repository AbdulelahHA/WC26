/* Wall-clock parts in the tournament's display timezone (Mecca for WC26),
   no matter where the page is opened. */
let fmt;
export function setTimezone(timeZone){
  fmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23' });
}

/* {y, mo (0-based), d, weekday ("Monday"), hm ("22:00"), key ("2026-5-11")} */
export function local(ms){
  const p = Object.fromEntries(fmt.formatToParts(ms).map(x => [x.type, x.value]));
  const y = +p.year, mo = +p.month - 1, d = +p.day;
  return { y, mo, d, weekday: p.weekday, hm: `${p.hour}:${p.minute}`, key: `${y}-${mo}-${d}` };
}

export const isSameDay = (a, b) => local(a).key === local(b).key;

export const pad = n => String(n).padStart(2, '0');

/* "1d 02:03:04" style countdown pieces */
export function countdown(ms){
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  return { d, clock: `${pad(h)}:${pad(m)}:${pad(s - m * 60)}` };
}
