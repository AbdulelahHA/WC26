/* The only mutable app state. Views subscribe and re-render from it.
   Preference keys match the old app so returning visitors keep their choices. */
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const json = (k, d) => { try { return JSON.parse(get(k)) ?? d; } catch { return d; } };

const savedTheme = get('wc26_theme');
export const state = {
  data: null,        /* {tournament, teams, fixtures, history, aliases} */
  model: null,       /* built from data + feeds, see logic/model.js */
  feed: 'loading',   /* loading | ok | err */
  lang: get('wc26_lang') === 'ar' ? 'ar' : 'en',
  theme: savedTheme || (matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'night'),
  pal: { night: get('wc26_pal_night') || 'navy', day: get('wc26_pal_day') || 'rose' },
  favs: Array.isArray(json('wc26_favs', [])) ? json('wc26_favs', []) : [],
  page: 'schedule'
};

const subs = new Set();
export const subscribe = fn => subs.add(fn);

/* patch state, persist preferences, tell every view what changed */
export function update(patch){
  Object.assign(state, patch);
  if('lang' in patch) put('wc26_lang', state.lang);
  if('theme' in patch) put('wc26_theme', state.theme);
  if('pal' in patch){ put('wc26_pal_night', state.pal.night); put('wc26_pal_day', state.pal.day); }
  if('favs' in patch) put('wc26_favs', JSON.stringify(state.favs));
  for(const fn of subs) fn(patch);
}

export const pickerSeen = () => get('wc26_picker_seen') === '1';
export const markPickerSeen = () => put('wc26_picker_seen', '1');
