/* The panel under a tapped match: Goals | Squad toggle, penalty shootout,
   bookings. Everything comes from the model match (result oriented to home). */
import { t, teamName, flag, esc } from '../i18n.js';
import { state } from '../store.js';
import { surname } from '../logic/names.js';

const ICON_BALL = `<img class="sq-ball" src="ball.png" alt="goal" onerror="this.style.display='none'">`;
const ICON_BOOT = `<img class="sq-boot" src="Assist.png" alt="assist" onerror="this.style.display='none'">`;
const cleanMinute = mn => (mn || '').toString().replace(/\s+/g, '').replace(/'+$/, '') + "'";
const pattern = code => state.data.teams[code]?.pattern || '';

/* assist for a scorer: match on minute first (reliable), then on surname */
function assistFor(m, scorer, minute){
  const list = m.extra?.assists || [];
  const mn = (minute || '').replace(/[^0-9+]/g, '');
  const byMin = list.find(a => mn && (a.minute || '').toString().replace(/[^0-9+]/g, '') === mn);
  if(byMin) return byMin.assist;
  const sn = surname(scorer);
  return list.find(a => sn && (a.scorer || '').toLowerCase().includes(sn))?.assist || null;
}

function goalsHTML(m){
  /* one line per player (a brace shows once with both minutes); OG/PEN per goal */
  const column = side => {
    const rows = new Map();
    for(const g of m.result?.goals || []){
      if(g.side !== side) continue;
      const key = g.name + '|' + (g.og ? 'og' : '');
      if(!rows.has(key)) rows.set(key, { name: g.name, og: g.og, mins: [] });
      rows.get(key).mins.push(g);
    }
    const code = side === 'h' ? m.home : m.away;
    return [...rows.values()].map(p => {
      const mins = p.mins.map(g => `${g.minute}${g.pen ? '<span class="g-tag pen">PEN</span>' : ''}`).join('<span class="g-sep">,</span>');
      const as = p.og ? null : p.mins.map(g => assistFor(m, p.name, g.minute)).find(Boolean);
      return `<div class="goal-line">
      <span class="flagbg" style="--gbg:${pattern(code)}"></span>
      <span class="g-min">${mins}</span>
      <span class="g-name">${esc(p.name)}${as ? `<span class="g-assist">${t('assist')}: ${esc(as)}</span>` : ''}</span>${p.og ? '<span class="g-tag og">OG</span>' : ''}
    </div>`;
    }).join('');
  };
  return `<div class="goal-col home">${column('h')}</div><div class="goal-col away">${column('a')}</div>`;
}

function squadHTML(m, panel){
  const lu = m.extra?.lineups;
  if(!lu || (!lu[m.home] && !lu[m.away])) return '';
  const goalsBy = {};
  for(const g of m.result?.goals || []){
    if(g.og) continue;
    const row = goalsBy[surname(g.name)] ||= { count: 0, mins: [] };
    row.count++; if(g.minute) row.mins.push(cleanMinute(g.minute));
  }
  const assisters = new Set((m.extra.assists || []).map(a => surname(a.assist)));
  const player = p => {
    const g = goalsBy[surname(p.name)];
    const goal = g ? `<span class="sq-mark">${ICON_BALL}${g.count > 1 ? `<span class="sq-x">×${g.count}</span>` : ''}${g.mins.length ? `<span class="sq-min">${g.mins.join(', ')}</span>` : ''}</span>` : '';
    const boot = assisters.has(surname(p.name)) ? `<span class="sq-mark">${ICON_BOOT}</span>` : '';
    return `<div class="sq-row"><span class="sq-num">${p.number || ''}</span><span class="sq-name">${esc(p.name)}</span><span class="sq-icons">${goal}${boot}</span></div>`;
  };
  const col = (code, side) => {
    const l = lu[code];
    if(!l) return `<div class="sq-col"><div class="sq-empty">${t('noLineup')}</div></div>`;
    const subs = (l.subs || []).map(player).join('');
    /* keep subs open across refreshes if the user had opened them */
    const open = panel?.querySelector(`.sq-subs-toggle[data-subs="${side}"]`)?.classList.contains('open');
    return `<div class="sq-col">
      <div class="sq-head">${flag(code)}<span class="sq-team">${teamName(code)}</span>${l.formation ? `<span class="sq-form">${l.formation}</span>` : ''}</div>
      <div class="sq-xi">${(l.xi || []).map(player).join('')}</div>
      ${subs ? `<button class="sq-subs-toggle${open ? ' open' : ''}" data-subs="${side}">${t('subs')} <span class="sq-caret">▾</span></button>
      <div class="sq-subs"${open ? '' : ' hidden'}>${subs}</div>` : ''}
    </div>`;
  };
  return `<div class="squad-view">${col(m.home, 'h')}${col(m.away, 'a')}</div>`;
}

function shootoutHTML(m){
  const r = m.result;
  if(!r || r.state !== 'AP' || !r.kicks.length) return '';
  const mark = ok => ok ? '<span class="pk-mark pk-yes">✅</span>' : '<span class="pk-mark pk-no">❌</span>';
  const rows = side => r.kicks.filter(k => k.side === side)
    .map(k => `<div class="pk-row ${k.scored ? 'scored' : 'missed'}">${mark(k.scored)}<span class="pk-name">${esc(k.name)}</span></div>`).join('');
  return `<div class="pen-shootout">
    <div class="pen-sh-head">
      <span class="pen-sh-title">${t('shootout')}</span>
      <span class="pen-sh-score">${flag(m.home)} ${r.penHome ?? ''} – ${r.penAway ?? ''} ${flag(m.away)}</span>
    </div>
    <div class="pen-sh-body">
      <div class="pk-col"><div class="pk-team">${flag(m.home)}<span>${teamName(m.home)}</span></div>${rows('h')}</div>
      <div class="pk-col"><div class="pk-team">${flag(m.away)}<span>${teamName(m.away)}</span></div>${rows('a')}</div>
    </div>
  </div>`;
}

function bookingsHTML(m){
  const cards = [...(m.extra?.cards || [])].sort((x, y) => parseInt(x.minute || 999, 10) - parseInt(y.minute || 999, 10));
  const rows = { h: '', a: '' };
  for(const c of cards){
    const side = c.team === m.home ? 'h' : c.team === m.away ? 'a' : null;
    if(!side) continue;
    const chip = /red/i.test(c.card) ? '<span class="bk-chip rc"></span>'
      : /second/i.test(c.card) ? '<span class="bk-chip yc"></span><span class="bk-chip rc"></span>' : '<span class="bk-chip yc"></span>';
    rows[side] += `<div class="bk-row">${chip}<span class="bk-name">${esc(c.player)}</span><span class="bk-min">${cleanMinute(c.minute)}</span></div>`;
  }
  if(!rows.h && !rows.a) return '';
  return `<div class="bookings"><div class="bk-head">${t('bookings')}</div><div class="bk-body">
    <div class="bk-col">${rows.h || '<div class="bk-none">—</div>'}</div>
    <div class="bk-col">${rows.a || '<div class="bk-none">—</div>'}</div></div></div>`;
}

/* default view: Goals if anyone scored, otherwise Squad; `mode` keeps the user's choice */
export function panelHTML(m, mode, panel){
  const squad = squadHTML(m, panel), goals = goalsHTML(m), pens = shootoutHTML(m), books = bookingsHTML(m);
  if(!squad) return `<div class="exp-body">${goals}</div>${pens}${books}`;
  const hasGoals = m.result && (m.result.goals.length || m.result.homeScore > 0 || m.result.awayScore > 0);
  const active = mode || (hasGoals ? 'goals' : 'squad');
  return `<div class="exp-toggle">
    <button class="exp-tab${active === 'goals' ? ' on' : ''}" data-exp="goals">${t('goals')}</button>
    <button class="exp-tab${active === 'squad' ? ' on' : ''}" data-exp="squad">${t('squad')}</button>
  </div>` + (active === 'squad' ? squad + books : `<div class="exp-body">${goals}</div>${pens}`);
}

export const hasLineup = m => !!(m.extra?.lineups[m.home]?.xi?.length || m.extra?.lineups[m.away]?.xi?.length);
