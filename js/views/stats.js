/* Stats page: history, Goals | Assists | Clean Sheets. */
import { state, update } from '../store.js';
import { t, ar, teamName, flag, flagCode, esc } from '../i18n.js';
import { isSameDay } from '../time.js';
import { topScorers, topAssists, cleanSheets, goalTotals, totalAssists, allTimeScorers } from '../logic/stats.js';

const $ = id => document.getElementById(id);
const flagUrl = (size, f) => `https://flagcdn.com/${size}/${f}.png`;

/* top 3 as gold/silver/bronze cards, the rest as rows */
function leaderboard(rows, value, word, extra = () => ''){
  const champs = rows.slice(0, 3).map((r, i) => `<div class="champ c${i + 1}">
      <div class="champ-medal">${i + 1}</div>
      <img class="champ-flag" src="${flagUrl('h60', flagCode(r.team))}" alt="${teamName(r.team)}">
      <div class="champ-name">${esc(r.name)}</div>
      <div class="champ-team">${teamName(r.team)}</div>
      <div class="champ-goals">${r[value]}<small>${word(r[value])}</small></div>
      ${r.pens > 0 ? `<div class="champ-pen">${r.pens} ${ar() ? 'ركلة جزاء' : 'pen'}</div>` : ''}
    </div>`).join('');
  const list = rows.slice(3).map((r, i) => `<div class="scorer-row">
      <span class="s-rank">${i + 4}</span>
      ${flag(r.team, 'h24', teamName(r.team)).replace('<img ', '<img class="s-flag" ')}
      <span class="s-name">${esc(r.name)}<span class="s-team">${teamName(r.team)}</span></span>
      <span class="s-goals">${r[value]}<small>${word(r[value])}</small>${extra(r)}</span>
    </div>`).join('');
  return `<div class="champ-row">${champs}</div>` + (list ? `<div class="scorers-list">${list}</div>` : '');
}
const statCard = (label, value, foot) => `<div class="stat-card sq"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${foot ? `<div class="stat-foot">${foot}</div>` : ''}</div>`;

function renderGoals(){
  const { model, data } = state;
  const rows = topScorers(model);
  $('scorers').innerHTML = rows.length
    ? leaderboard(rows, 'goals', () => t('goalsWord'), r => r.pens > 0 ? ` <span class="pen-tag">${r.pens} ${t('pen')}</span>` : '')
    : `<div class="scorers-empty">${t('noGoals')}</div>`;

  const { total, today, pens } = goalTotals(model, ko => isSameDay(ko, Date.now()));
  $('stats-totals').innerHTML = `<div class="stat-cards">
    ${statCard(t('totalGoals'), total, today > 0 ? `<span class="stat-delta">+${today} ${t('todayWord')}</span>` : '')}
    ${statCard(t('penaltyGoals'), pens, `<span class="stat-sub">${t('fromSpot')}</span>`)}
  </div>`;

  const all = allTimeScorers(data.history, topScorers(model, Infinity), data.teams);
  $('stats-history').innerHTML = `<div class="hist-wrap" style="margin-top:18px">
    <div class="hist-head"><span class="hist-title">${t('scorersTitle')}</span></div>
    ${all.map((p, i) => `<div class="hist-row"><span class="t-rank">${i + 1}</span><img src="${flagUrl('h24', p.flag)}" alt=""><span class="hist-nm">${esc(p.name)}</span><span class="hist-count">${p.goals} ${t('goalsWord')}</span></div>`).join('')}
  </div>`;
}

function renderAssists(){
  const rows = topAssists(state.model);
  $('assisters').innerHTML = rows.length ? leaderboard(rows, 'assists', () => t('assistsWord')) : `<div class="scorers-empty">${t('noAssists')}</div>`;
  $('assists-totals').innerHTML = `<div class="stat-cards">${statCard(t('totalAssists'), totalAssists(state.model))}<div class="stat-card sq empty-card"></div></div>`;
}

function renderSheets(){
  const rows = cleanSheets(state.model);
  $('sheets').innerHTML = rows.length ? rows.map((r, i) => `<div class="scorer-row">
      <span class="s-rank">${i + 1}</span>
      ${flag(r.team).replace('<img ', '<img class="s-flag" ')}
      <span class="s-name">${esc(r.name)}<span class="s-team">${teamName(r.team)}</span></span>
      <span class="s-goals">${r.sheets}<small>${r.sheets === 1 ? t('cleanSheet') : t('cleanSheetsWord')}</small></span>
    </div>`).join('') : `<div class="scorers-empty">${t('noSheets')}</div>`;
}

function renderWinners(){
  const { winners } = state.data.history;
  $('stats-winners').innerHTML = `<div class="hist-wrap">
    <div class="hist-head"><span class="hist-title">${t('winnersTitle')}</span></div>
    ${winners.map(w => `<div class="hist-row"><img src="${flagUrl('h24', w.flag)}" alt=""><span class="hist-nm">${w[state.lang]}</span><span class="hist-stars">${'★'.repeat(w.titles)}</span><span class="hist-count">${w.titles} ${w.titles === 1 ? t('title') : t('titles')}</span></div>`).join('')}
  </div>`;
}

export function renderStats(){
  const tab = state.statsTab || 'goals';
  for(const p of ['goals', 'assists', 'sheets']){
    $('pane-' + p).hidden = p !== tab;
    $('stab-' + p).classList.toggle('on', p === tab);
  }
  if(state.page !== 'stats') return;
  renderWinners();
  ({ goals: renderGoals, assists: renderAssists, sheets: renderSheets })[tab]();
}

export function initStats(){
  for(const p of ['goals', 'assists', 'sheets']) $('stab-' + p).addEventListener('click', () => update({ statsTab: p }));
}
