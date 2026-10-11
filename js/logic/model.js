/* The whole tournament picture at one moment: fixtures + feed results in,
   matches with teams/results/state, group tables and the resolved knockout
   out. Rebuilt on every feed load; views only read it. */
import { pairKey, orient } from './feed.js';
import { effectiveState, winnerSide } from './status.js';
import { groupsOf, computeTable, qualification } from './standings.js';

export function buildModel({ tournament, teams, fixtures }, { results, extras }, now){
  const nameOf = c => teams[c]?.en ?? c;
  const attach = (f, home, away) => {
    const kickoff = Date.parse(f.kickoff);
    const ko = f.stage !== 'group';
    const raw = home && away ? results.get(pairKey(home, away, ko)) : null;
    const result = orient(raw, home);
    return {
      ...f, kickoff, home, away, result,
      extra: home && away ? extras.get([home, away].sort().join('-')) ?? null : null,
      state: effectiveState(result, kickoff, now)
    };
  };

  const matches = fixtures.filter(f => f.stage === 'group').map(f => attach(f, f.home, f.away));
  const groups = groupsOf(matches);
  const tables = Object.fromEntries(Object.entries(groups).map(([g, codes]) =>
    [g, computeTable(codes, matches.filter(m => m.group === g), nameOf)]));
  const pic = qualification(tables, tournament.thirdPlace, nameOf);

  /* knockout: resolve each slot in match order (feeders always come first) */
  const winner = {}, loser = {};
  const slot = (code, id) => {
    const g = code.slice(1);
    if(code[0] === '1') return pic.winners[g]?.settled ? pic.winners[g].code : null;
    if(code[0] === '2') return pic.runners[g]?.settled ? pic.runners[g].code : null;
    if(code[0] === '3') return pic.thirdSlots?.[id] ?? null;
    if(code[0] === 'W') return winner[g] ?? null;
    if(code[0] === 'L') return loser[g] ?? null;
    return code;  /* a plain team code: fixture already known */
  };
  for(const f of fixtures.filter(f => f.stage !== 'group').sort((a, b) => a.id - b.id)){
    const m = attach(f, slot(f.home, f.id), slot(f.away, f.id));
    const w = winnerSide(m.result);
    if(w){ winner[f.id] = w === 'h' ? m.home : m.away; loser[f.id] = w === 'h' ? m.away : m.home; }
    matches.push(m);
  }
  matches.sort((a, b) => a.kickoff - b.kickoff || a.id - b.id);

  return {
    matches, byId: new Map(matches.map(m => [m.id, m])),
    groups, tables, pic, winner, loser,
    champion: winner[tournament.bracket.final] ?? null
  };
}

/* a team's matches, in date order (opponent may still be unknown → skipped) */
export const matchesOf = (model, code) => model.matches.filter(m => (m.home === code || m.away === code) && m.home && m.away);
