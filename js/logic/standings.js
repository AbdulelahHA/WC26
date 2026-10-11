/* Group tables and the "who qualifies" picture. Pure: matches in, tables out.
   Each match: {group, home, away, state, result} with result oriented to home. */
import { IN_PLAY, FINISHED } from './status.js';

export function groupsOf(matches){
  const groups = {};
  for(const m of matches) if(m.stage === 'group') (groups[m.group] ||= new Set()).add(m.home).add(m.away);
  return Object.fromEntries(Object.keys(groups).sort().map(g => [g, [...groups[g]]]));
}

/* P/W/D/L/GF/GA/Pts + a form trail; in-play matches count provisionally */
export function computeTable(codes, matches, nameOf){
  const tbl = Object.fromEntries(codes.map(c => [c, { code: c, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, seq: [], live: false }]));
  for(const m of matches){
    const A = tbl[m.home], B = tbl[m.away];
    if(!A || !B || !m.result) continue;
    const live = IN_PLAY.has(m.state);
    if(!live && !FINISHED.has(m.state)) continue;
    if(!live && m.result.homeScore == null && m.result.awayScore == null) continue;
    const ha = m.result.homeScore ?? 0, hb = m.result.awayScore ?? 0;
    A.P++; B.P++; A.GF += ha; A.GA += hb; B.GF += hb; B.GA += ha;
    if(live) A.live = B.live = true;
    const tag = t => live ? t + 'l' : t;          /* 'wl' = provisional win dot */
    if(ha > hb){ A.W++; B.L++; A.Pts += 3; A.seq.push(tag('w')); B.seq.push(tag('l')); }
    else if(hb > ha){ B.W++; A.L++; B.Pts += 3; B.seq.push(tag('w')); A.seq.push(tag('l')); }
    else { A.D++; B.D++; A.Pts++; B.Pts++; A.seq.push(tag('d')); B.seq.push(tag('d')); }
  }
  const rows = Object.values(tbl);
  rows.forEach(r => { r.GD = r.GF - r.GA; });
  return rows.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || nameOf(x.code).localeCompare(nameOf(y.code)));
}

/* winners, runners-up, ranked thirds, and — once every group is settled —
   which third-placed team fills each knockout slot (official lookup table) */
export function qualification(tables, thirdPlace, nameOf){
  const winners = {}, runners = {}, thirds = [];
  for(const [g, rows] of Object.entries(tables)){
    const settled = rows.every(r => r.P >= rows.length - 1);
    winners[g] = { code: rows[0]?.code ?? null, settled };
    runners[g] = { code: rows[1]?.code ?? null, settled };
    if(rows[2]) thirds.push({ code: rows[2].code, grp: g, Pts: rows[2].Pts, GD: rows[2].GD, GF: rows[2].GF, settled });
  }
  thirds.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || nameOf(a.code).localeCompare(nameOf(b.code)));

  let thirdSlots = null;
  const top = thirds.slice(0, thirdPlace?.qualify || 0);
  if(thirdPlace && thirds.length === Object.keys(tables).length && thirds.every(t => t.settled)){
    const assign = thirdPlace.table[top.map(t => t.grp).sort().join('')];
    if(assign){
      const byGroup = Object.fromEntries(top.map(t => [t.grp, t.code]));
      thirdSlots = Object.fromEntries(thirdPlace.slotMatches.map((id, i) => [id, byGroup[assign[i]] ?? null]));
    }
  }
  return { winners, runners, thirds, qualifiedThirds: new Set(top.map(t => t.code)), thirdSlots };
}
