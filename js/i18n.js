/* Text lookups in the current language + small HTML helpers shared by views. */
import strings from './strings.js';
import { state } from './store.js';

export const ar = () => state.lang === 'ar';

/* UI string first, then the tournament's own text, then English */
export function t(key){
  const own = state.data?.tournament.text;
  return strings[state.lang][key] ?? own?.[state.lang]?.[key] ?? strings.en[key] ?? own?.en?.[key] ?? key;
}

export const teamName = code => state.data.teams[code]?.[state.lang] || state.data.teams[code]?.en || code;
export const dayName = weekday => strings[state.lang].weekdays[weekday] || weekday;
export const monthName = mo => t('months')[mo];
export const roundLabel = r => state.data.tournament.roundLabel[r][state.lang];
export const roundShort = r => state.data.tournament.roundShort[r][state.lang];
export const plural = (n, one, many) => n === 1 ? t(one) : t(many);

/* "California, USA" -> host-country word swapped into Arabic, rest kept */
export function regionText(region){
  if(!ar()) return region;
  for(const [en, a] of Object.entries(state.data.tournament.hostNames))
    if(region.endsWith(en)) return region.slice(0, -en.length) + a;
  return region;
}

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const flagCode = code => state.data.teams[code]?.flag || '';
export const flag = (code, size = 'h24', alt = '') =>
  code ? `<img src="https://flagcdn.com/${size}/${flagCode(code)}.png" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'">` : '';
