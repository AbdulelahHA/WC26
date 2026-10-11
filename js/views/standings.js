/* Standings page: Knockout (radial bracket) | Groups tabs. */
import { state, update } from '../store.js';
import { t, teamName, flag } from '../i18n.js';
import { bracketSVG, openFullscreen } from './bracket.js';

const $ = id => document.getElementById(id);

function groupsHTML(){
  const { tables, pic } = state.model;
  const h = t('table');
  return Object.entries(tables).map(([g, rows]) => {
    const live = rows.some(r => r.live);
    const body = rows.map((r, i) => {
      /* through = top two, or one of the best third-placed teams */
      const q = i < 2 || (i === 2 && pic.qualifiedThirds.has(r.code));
      const cls = [i === 0 && 'q1', i === 1 && 'q2', q && i === 2 && 'q3', r.live && 'row-live'].filter(Boolean).join(' ');
      return `<tr class="${cls}">
        <td class="rank">${i + 1}</td>
        <td><div class="team-cell">${flag(r.code)}<span class="nm">${teamName(r.code)}${q ? `<span class="qual-tag${i === 2 ? ' qual-third' : ''}">${t('qualified')}</span>` : ''}</span>${r.live ? '<span class="row-live-dot"></span>' : ''}</div></td>
        <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
        <td>${r.GD > 0 ? '+' : ''}${r.GD}</td><td class="pts${r.live ? ' pts-live' : ''}">${r.Pts}</td>
      </tr>`;
    }).join('');
    return `<div class="group-card${live ? ' card-live' : ''}" id="group-${g}">
      <div class="group-head"><span class="group-letter">${g}</span><span class="group-title">${t('group')} ${g}</span>${live ? `<span class="live-pill">${t('live')}</span>` : ''}</div>
      <table class="gtable">
        <thead><tr><th class="rank"></th><th class="team-col">${h.team}</th><th>${h.p}</th><th>${h.w}</th><th>${h.d}</th><th>${h.l}</th><th>${h.gd}</th><th>${h.pts}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }).join('');
}

export function renderStandings(){
  const tab = state.standingsTab || 'knockout';
  $('groups').hidden = tab !== 'groups';
  $('knockout').hidden = tab !== 'knockout';
  $('tab-groups').classList.toggle('active', tab === 'groups');
  $('tab-knockout').classList.toggle('active', tab === 'knockout');
  $('t-ko-title').innerHTML = tab === 'knockout' ? t('koTitle') : t('groupsTitle');
  $('t-ko-sub').textContent = tab === 'knockout' ? t('koSub') : t('groupsSub');
  if(state.page !== 'standings') return;      /* off-screen: render on entry instead */
  if(tab === 'groups') $('groups').innerHTML = groupsHTML();
  else $('knockout').innerHTML = `<div class="kr-wrap">${bracketSVG()}
    <button class="kr-expand" id="kr-expand" aria-label="${t('fullscreen')}" title="${t('fullscreen')}">⛶</button></div>`;
}

/* a group badge on the Schedule lands here: scroll to the table and flash it */
export function focusGroup(g){
  setTimeout(() => {
    const card = $('group-' + g);
    if(!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('flash'); void card.offsetWidth;
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1200);
  }, 60);
}

export function initStandings(){
  $('tab-groups').addEventListener('click', () => update({ standingsTab: 'groups' }));
  $('tab-knockout').addEventListener('click', () => update({ standingsTab: 'knockout' }));
  $('knockout').addEventListener('click', e => { if(e.target.closest('#kr-expand')) openFullscreen(); });
}
