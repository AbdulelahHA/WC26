/* "Your Teams": a strip per followed team on every page (matches / standing /
   scorers depending on the page), and the picker overlay to choose them. */
import { state, update, pickerSeen, markPickerSeen } from '../store.js';
import { t, teamName, flag, flagCode, esc, roundShort } from '../i18n.js';
import { local } from '../time.js';
import { IN_PLAY, FINISHED } from '../logic/status.js';
import { matchesOf } from '../logic/model.js';
import { teamScorers } from '../logic/stats.js';

const MAX = 5;
const $ = id => document.getElementById(id);

function standingOf(code){
  for(const [grp, rows] of Object.entries(state.model.tables)){
    const i = rows.findIndex(r => r.code === code);
    if(i >= 0) return { ...rows[i], pos: i + 1, grp };
  }
  return null;
}

function matchesBlock(code){
  const now = Date.now();
  const list = matchesOf(state.model, code);
  const next = list.find(m => !FINISHED.has(m.state) && !IN_PLAY.has(m.state) && m.kickoff > now);
  const rows = list.map(m => {
    const home = m.home === code, opp = home ? m.away : m.home, r = m.result;
    const us = (home ? r?.homeScore : r?.awayScore) ?? 0, them = (home ? r?.awayScore : r?.homeScore) ?? 0;
    const head = `${m.stage === 'group' ? '' : `<span class="fm-round">${roundShort(m.stage)}</span>`}${t('vs')} ${flag(opp)}${teamName(opp)}`;
    if(FINISHED.has(m.state)){
      const pens = m.state === 'AP' && r.penHome != null ? `<span class="fm-pens">(${home ? `${r.penHome}-${r.penAway}` : `${r.penAway}-${r.penHome}`} ${t('pens')})</span>` : '';
      const tag = m.state === 'AP' ? t('pensTag') : m.state === 'AET' ? t('aet') : t('ft');
      return `<div class="fav-match"><span class="fm-opp">${head}</span><span class="fm-res">${us} – ${them}${pens}<small>${tag}</small></span></div>`;
    }
    if(IN_PLAY.has(m.state))
      return `<div class="fav-match fm-live"><span class="fm-opp">${head}</span><span class="fm-res">${us} – ${them}<small>${t('live')}</small></span></div>`;
    const p = local(m.kickoff), isNext = m === next;
    return `<div class="fav-match${isNext ? ' fm-next' : ''}"><span class="fm-opp">${head}</span><span class="fm-res">${t('monthsShort')[p.mo]} ${p.d} · ${p.hm}${isNext ? `<span class="fm-cd" data-utc="${m.kickoff}"></span>` : ''}</span></div>`;
  }).join('');
  return `<div class="fav-block-label">${t('matches')}</div>${rows || `<div class="fav-empty">${t('noMatches')}</div>`}`;
}

function bodyFor(code, mode){
  if(mode === 'matches') return matchesBlock(code);
  if(mode === 'standings'){
    const s = standingOf(code);
    if(!s) return `<div class="fav-empty">${t('noData')}</div>`;
    const h = t('table');
    return `<div class="fav-block-label">${t('standing')}</div><div class="fav-stats">
      <span>${t('pos')} <b>${s.pos}</b></span><span>${h.p} <b>${s.P}</b></span><span>${h.w} <b>${s.W}</b></span>
      <span>${h.d} <b>${s.D}</b></span><span>${h.l} <b>${s.L}</b></span>
      <span>${h.gd} <b>${s.GD > 0 ? '+' : ''}${s.GD}</b></span><span>${h.pts} <b>${s.Pts}</b></span></div>`;
  }
  const sc = teamScorers(state.model, code);
  return `<div class="fav-block-label">${t('scorers')}</div>` + (sc.length
    ? sc.map(s => `<div class="fav-scorer"><span class="fs-min">${s.goals}×</span>${esc(s.name)}</div>`).join('')
    : `<div class="fav-empty">${t('noTeamGoals')}</div>`);
}

export function renderFavorites(){
  const { favs } = state, single = favs.length === 1;
  for(const sec of document.querySelectorAll('.favorites')){
    sec.hidden = !favs.length;
    if(!favs.length) continue;
    const mode = sec.dataset.mode;
    const open = new Set([...sec.querySelectorAll('.fav-strip.open')].map(s => s.dataset.code));
    sec.querySelector('.fav-strips').innerHTML = favs.map(code => {
      const s = standingOf(code);
      const meta = !s ? '' : mode === 'matches' ? `${t('group')} ${s.grp}` : `${t('group')} ${s.grp} · ${s.Pts} ${t('pts')}`;
      return `<div class="fav-strip${single || open.has(code) ? ' open' : ''}" data-code="${code}">
        <div class="fav-strip-head">${flag(code)}<span class="fav-strip-name">${teamName(code)}</span><span class="fav-strip-meta">${meta}</span>${single ? '' : '<span class="fav-strip-chev"></span>'}</div>
        <div class="fav-strip-body">${bodyFor(code, mode)}</div>
      </div>`;
    }).join('');
    sec.querySelector('.fav-title').textContent = single ? t('yourTeam') : t('yourTeams');
    sec.querySelector('.fav-edit').innerHTML = t('edit');
  }
}

/* ---- picker ---- */
let picked = [];

function renderPicker(){
  const { teams, tournament } = state.data;
  $('picker-title').textContent = t('pickerTitle');
  $('picker-sub').innerHTML = `${t('pickerSub')} · <span id="picker-count">${picked.length}</span>/${MAX}`;
  $('picker-confirm').textContent = t('confirm');
  $('picker-skip').textContent = t('later');
  $('picker-grid').innerHTML = tournament.regions.order.map(r => {
    const codes = Object.keys(teams).filter(c => teams[c].region === r).sort((a, b) => teamName(a).localeCompare(teamName(b)));
    if(!codes.length) return '';
    return `<div class="picker-region"><h3>${tournament.regions.label[r][state.lang]}</h3><div class="picker-teams">${codes.map(c =>
      `<div class="pteam" data-code="${c}"><img src="https://flagcdn.com/w80/${flagCode(c)}.png" alt="${teamName(c)}"><span>${teamName(c)}</span></div>`).join('')}</div></div>`;
  }).join('');
  syncPicker();
}
function syncPicker(){
  $('picker-count').textContent = picked.length;
  for(const el of document.querySelectorAll('.pteam')){
    const sel = picked.includes(el.dataset.code);
    el.classList.toggle('sel', sel);
    el.classList.toggle('dim', picked.length >= MAX && !sel);   /* full: dim the rest */
  }
  $('picker-confirm').disabled = !picked.length;
}
export function openPicker(){
  picked = [...state.favs];
  renderPicker();
  $('picker').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closePicker(){
  $('picker').hidden = true;
  document.body.style.overflow = '';
}
export const pickerOpen = () => !$('picker').hidden;
export { renderPicker };

export function initFavorites(){
  $('picker-grid').addEventListener('click', e => {
    const el = e.target.closest('.pteam');
    if(!el) return;
    const i = picked.indexOf(el.dataset.code);
    if(i >= 0) picked.splice(i, 1);
    else if(picked.length < MAX) picked.push(el.dataset.code);
    syncPicker();
  });
  $('picker-confirm').addEventListener('click', () => { closePicker(); update({ favs: [...picked] }); });
  /* "Maybe later": dismiss and don't nag again on the next visit */
  $('picker-skip').addEventListener('click', () => { markPickerSeen(); closePicker(); });
  for(const sec of document.querySelectorAll('.favorites')) sec.addEventListener('click', e => {
    if(state.favs.length <= 1) return;
    e.target.closest('.fav-strip-head')?.closest('.fav-strip').classList.toggle('open');
  });
  for(const b of document.querySelectorAll('.fav-edit-btn')) b.addEventListener('click', openPicker);
  if(!state.favs.length && !pickerSeen()) openPicker();
}
