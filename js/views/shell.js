/* App chrome: header, settings dropdown (language, theme, palette), bottom
   nav, feed status pill. */
import { state, update } from '../store.js';
import { t } from '../i18n.js';
import { SUN, MOON } from './icons.js';
import { openPicker } from './favorites.js';

const $ = id => document.getElementById(id);
const PAL_CLASS = { navy: '', charcoal: 'pal-charcoal', green: 'pal-green', rose: 'pal-rose', brown: 'pal-brown', ivory: 'pal-ivory' };

/* every static label in the page, in the current language */
export function applyChrome(){
  const ar = state.lang === 'ar';
  document.body.classList.toggle('ar', ar);
  document.documentElement.lang = state.lang;
  document.title = t('title');
  const set = (id, key) => { const el = $(id); if(el) el.innerHTML = t(key); };
  set('t-eyebrow', 'eyebrow'); set('t-h1', 'h1'); set('t-footer', 'footer');
  set('tab-groups', 'groups'); set('tab-knockout', 'knockout');
  set('t-stats-title', 'statsTitle'); set('t-stats-sub', 'statsSub');
  set('stab-goals', 'goals'); set('stab-assists', 'assists'); set('stab-sheets', 'cleanSheets');
  set('bnav-schedule', 'schedule'); set('bnav-standings', 'standings'); set('bnav-stats', 'stats');
  set('settings-label', 'settings'); set('dd-title', 'settings');
  set('lbl-lang', 'language'); set('lbl-theme', 'theme'); set('lbl-palette', 'colour'); set('lbl-edit', 'editTeams');
  for(const b of document.querySelectorAll('#seg-theme button')) b.textContent = t(b.dataset.theme);
  for(const b of document.querySelectorAll('#seg-lang button')) b.classList.toggle('on', b.dataset.lang === state.lang);
  const { hosts, logo } = state.data.tournament;
  $('hosts-line').innerHTML = hosts.map(h => `<img src="https://flagcdn.com/h24/${h}.png" alt="">`).join('');
  $('nav-logo').src = logo;
}

export function applyTheme(){
  const light = state.theme === 'light';
  document.body.classList.toggle('light', light);
  for(const c of Object.values(PAL_CLASS)) if(c) document.body.classList.remove(c);
  const pal = light ? state.pal.day : state.pal.night;
  if(PAL_CLASS[pal]) document.body.classList.add(PAL_CLASS[pal]);
  $('theme-svg').innerHTML = light ? SUN : MOON;
  for(const b of document.querySelectorAll('#seg-theme button')) b.classList.toggle('on', b.dataset.theme === state.theme);
  $('swatches-night').hidden = light;
  $('swatches-day').hidden = !light;
  for(const s of document.querySelectorAll('.swatch')) s.classList.toggle('on', s.dataset.pal === pal);
}

export function showPage(){
  for(const p of ['schedule', 'standings', 'stats']) $('page-' + p).hidden = p !== state.page;
  for(const b of document.querySelectorAll('.bnav-btn')) b.classList.toggle('active', b.dataset.page === state.page);
  scrollTo({ top: 0, behavior: 'instant' });
}

/* pending until the first good load; on error only shown if we never had data */
export function feedStatus(){
  const el = $('feed-status');
  if(state.feed === 'ok' || (state.feed === 'err' && state.model?.matches.some(m => m.result))){ el.hidden = true; return; }
  el.classList.toggle('err', state.feed === 'err');
  el.textContent = t(state.feed === 'err' ? 'feedError' : 'feedLoading');
  el.hidden = false;
}

export function initShell(){
  $('seg-lang').addEventListener('click', e => { const b = e.target.closest('button'); if(b) update({ lang: b.dataset.lang }); });
  $('seg-theme').addEventListener('click', e => { const b = e.target.closest('button'); if(b) update({ theme: b.dataset.theme }); });
  $('row-palette').addEventListener('click', e => {
    const s = e.target.closest('.swatch');
    if(s) update({ pal: { ...state.pal, [state.theme === 'light' ? 'day' : 'night']: s.dataset.pal } });
  });
  const dd = $('settings-dd');
  $('settings-btn').addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', e => { if(!e.target.closest('.settings-wrap')) dd.classList.remove('open'); });
  $('settings-edit-teams').addEventListener('click', () => { dd.classList.remove('open'); openPicker(); });
  $('bottom-nav').addEventListener('click', e => { const b = e.target.closest('.bnav-btn'); if(b) update({ page: b.dataset.page }); });
}
