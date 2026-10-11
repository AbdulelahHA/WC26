/* Feed adapter: turns the two Worker payloads into clean results keyed by
   team codes. Every quirk of the feeds (name joins, garbled player names,
   split stoppage minutes, penalty data arriving from the second feed) is
   handled here once, so views only ever see clean data. */
import { teamResolver, cleanGoal, bestSquadMatch } from './names.js';

/* one key per pairing + stage bucket, independent of home/away order.
   (Two teams can meet twice: once in the groups, once in the knockout.) */
export const pairKey = (a, b, ko) => (ko ? 'k:' : 'g:') + [a, b].sort().join('-');

const squadOf = lu => lu ? [...(lu.xi || []), ...(lu.subs || [])].map(p => p?.name).filter(Boolean) : [];

/* scores: {matches:[{home,away,homeScore,awayScore,state,penHome,penAway,pens,type,homeGoals,awayGoals}]}
   extra:  {matches:{k:{home,away,lineups:{home,away},assists,cards,pen}}} */
export function buildResults(scores, extra, teams, aliases){
  const codeOf = teamResolver(teams, aliases);
  const unmatched = new Set();
  const code = name => { const c = codeOf(name); if(!c && name) unmatched.add(name); return c; };

  /* extra feed first: lineups are needed to repair the scores feed's names */
  const extras = new Map();
  for(const m of Object.values(extra?.matches || {})){
    const h = code(m.home), a = code(m.away);
    if(!h || !a) continue;
    extras.set([h, a].sort().join('-'), {
      lineups: { [h]: m.lineups?.home || null, [a]: m.lineups?.away || null },
      assists: (m.assists || []).filter(x => x.assist).map(x => ({ ...x, team: code(x.team) })),
      cards: (m.cards || []).map(c => ({ ...c, team: code(c.team) })),
      pen: m.pen ? { ...m.pen, home: h } : null
    });
  }

  const results = new Map();
  for(const m of scores?.matches || []){
    const home = code(m.home), away = code(m.away);
    if(!home || !away) continue;
    const ex = extras.get([home, away].sort().join('-'));
    const fix = (name, team) => {
      const squad = squadOf(ex?.lineups[team]);
      return (squad.length && bestSquadMatch(name, squad)) || name;
    };
    const goals = side => (side === 'h' ? m.homeGoals : m.awayGoals || []) || [];
    const r = {
      home, away,
      state: m.state || 'NS',
      homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
      penHome: m.penHome ?? null, penAway: m.penAway ?? null,
      kicks: (m.pens || []).map(p => ({ side: p.t, name: fix(p.name, p.t === 'h' ? home : away), scored: !!p.scored })),
      /* side = the column the goal belongs to; an own goal sits on the side it counted for */
      goals: ['h', 'a'].flatMap(side => goals(side).map(g => {
        const { name, minute } = cleanGoal(g.name, g.minute);
        const team = side === 'h' ? home : away;
        return { side, name: g.og ? name : fix(name, team), minute, pen: !!g.pen, og: !!g.og };
      }))
    };
    mergePenalties(r, ex?.pen);
    results.set(pairKey(home, away, m.type && m.type !== 'group'), r);
  }
  return { results, extras, unmatched: [...unmatched] };
}

/* the extra feed sometimes knows a match went to extra time / penalties before
   the scores feed does — fill gaps only, never overwrite what scores sent */
function mergePenalties(r, pen){
  if(!pen) return;
  const flip = pen.home !== r.home;
  if((pen.state === 'AP' || pen.state === 'AET') && (r.state === 'FT' || !r.state)) r.state = pen.state;
  if(pen.state !== 'AP') return;
  if(r.penHome == null && pen.penHome != null) r.penHome = flip ? pen.penAway : pen.penHome;
  if(r.penAway == null && pen.penAway != null) r.penAway = flip ? pen.penHome : pen.penAway;
  if(!r.kicks.length && Array.isArray(pen.pens))
    r.kicks = pen.pens.map(k => ({ side: flip ? (k.t === 'h' ? 'a' : 'h') : k.t, name: k.name, scored: !!k.scored }));
}

/* view a result from a given home team's perspective */
export function orient(r, homeCode){
  if(!r || r.home === homeCode) return r;
  const sw = s => (s === 'h' ? 'a' : 'h');
  return {
    ...r, home: r.away, away: r.home,
    homeScore: r.awayScore, awayScore: r.homeScore,
    penHome: r.penAway, penAway: r.penHome,
    kicks: r.kicks.map(k => ({ ...k, side: sw(k.side) })),
    goals: r.goals.map(g => ({ ...g, side: sw(g.side) }))
  };
}
