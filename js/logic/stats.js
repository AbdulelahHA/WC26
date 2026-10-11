/* Tournament stats, all derived from the model. */
import { FINISHED } from './status.js';
import { surname, isAbbreviationOf } from './names.js';

const played = model => model.matches.filter(m => m.result);
const tally = (map, key, make) => (map[key] ||= make());

/* the feed spells one player two ways ("K. Mbappé" / "Kylian Mbappé"):
   fold each abbreviated row into the full-name row of the same team */
function mergeAbbreviated(rows, fields){
  for(const short of rows){
    const full = rows.find(r => r !== short && !r.merged && r.team === short.team && isAbbreviationOf(short.name, r.name));
    if(!full) continue;
    for(const f of fields) full[f] += short[f];
    short.merged = true;
  }
  return rows.filter(r => !r.merged);
}

export function topAssists(model, limit = 10){
  const t = {};
  for(const m of played(model)) for(const a of m.extra?.assists || [])
    tally(t, a.assist.trim() + '|' + a.team, () => ({ name: a.assist.trim(), team: a.team, assists: 0 })).assists++;
  return Object.values(t).sort((x, y) => y.assists - x.assists || x.name.localeCompare(y.name)).slice(0, limit);
}

/* Golden Boot order: goals, then assists, then fewer penalties, then name.
   Own goals credit nobody. */
export function topScorers(model, limit = 10){
  const t = {};
  for(const m of played(model)) for(const g of m.result.goals){
    if(g.og || !g.name) continue;
    const team = g.side === 'h' ? m.home : m.away;
    const row = tally(t, g.name + '|' + team, () => ({ name: g.name, team, goals: 0, pens: 0 }));
    row.goals++; if(g.pen) row.pens++;
  }
  /* the two feeds spell names differently — join assists on surname + team */
  const assists = Object.fromEntries(topAssists(model, Infinity).map(a => [surname(a.name) + '|' + a.team, a.assists]));
  const rows = mergeAbbreviated(Object.values(t), ['goals', 'pens']);
  rows.forEach(r => { r.assists = assists[surname(r.name) + '|' + r.team] || 0; });
  return rows.sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.pens - b.pens || a.name.localeCompare(b.name)).slice(0, limit);
}

/* finished match + conceded nothing → credit the starting keeper */
export function cleanSheets(model, limit = 10){
  const t = {};
  const keeper = lu => lu?.xi?.find(p => /goal|^gk$/i.test(p?.pos || ''))?.name;
  for(const m of played(model)){
    if(!FINISHED.has(m.state) || !m.extra) continue;
    const credit = team => { const gk = keeper(m.extra.lineups[team]); if(gk) tally(t, gk + '|' + team, () => ({ name: gk, team, sheets: 0 })).sheets++; };
    if(!(m.result.awayScore > 0)) credit(m.home);
    if(!(m.result.homeScore > 0)) credit(m.away);
  }
  return Object.values(t).sort((x, y) => y.sheets - x.sheets || x.name.localeCompare(y.name)).slice(0, limit);
}

export function goalTotals(model, isToday){
  let total = 0, today = 0, pens = 0;
  for(const m of played(model)){
    const g = (m.result.homeScore ?? 0) + (m.result.awayScore ?? 0);
    total += g;
    if(isToday(m.kickoff)) today += g;
    pens += m.result.goals.filter(x => x.pen && !x.og).length;
  }
  return { total, today, pens };
}

export const totalAssists = model => played(model).reduce((n, m) => n + (m.extra?.assists.length || 0), 0);

/* all-time list, topped up live for players still active at this tournament */
export function allTimeScorers(history, scorers, teams){
  /* surname + nationality, so a namesake from another country never counts */
  const live = {};
  for(const r of scorers){
    const k = surname(r.name) + '|' + teams[r.team]?.flag;
    live[k] = (live[k] || 0) + r.goals;
  }
  return history.scorers
    .map(p => ({ ...p, goals: p.goals + (history.activeScorers[surname(p.name)] ? live[surname(p.name) + '|' + p.flag] || 0 : 0) }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

export function teamScorers(model, code){
  const t = {};
  for(const m of played(model)) for(const g of m.result.goals){
    if(g.og || !g.name || (g.side === 'h' ? m.home : m.away) !== code) continue;
    tally(t, g.name, () => ({ name: g.name, team: code, goals: 0 })).goals++;
  }
  return mergeAbbreviated(Object.values(t), ['goals']).sort((a, b) => b.goals - a.goals);
}
