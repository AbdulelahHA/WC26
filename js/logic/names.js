/* Name handling for the feeds. The scores feed joins on team NAMES and sends
   player names through a broken transliteration, so all of that quirk-handling
   lives here — nothing else in the app compares raw names. */

export const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/* feed team name -> team code. Lower/trim/collapse, alias table, then
   accent-stripped comparison against our own English names. */
export function teamResolver(teams, aliases){
  const canon = s => {
    const x = stripAccents((s || '').toLowerCase().trim().replace(/\s+/g, ' '));
    for(const k in aliases) if(stripAccents(k) === x) return stripAccents(aliases[k]);
    return x;
  };
  const byName = new Map(Object.entries(teams).map(([code, t]) => [canon(t.en), code]));
  return name => byName.get(canon(name)) || null;
}

/* a stoppage-time goal can arrive split: name "K. Mbappe 90+", minute "5".
   Fold the leaked base minute back in, and strip any trailing minute left on
   the name so one player's goals never split across two spellings. */
export function cleanGoal(name, minute){
  let nm = (name || '').trim(), min = (minute ?? '').toString().trim();
  const leak = nm.match(/\s+(\d{1,3})\s*\+\s*$/);
  if(leak){
    nm = nm.slice(0, leak.index).trim();
    const extra = min.replace(/\D/g, '');
    min = extra ? `${leak[1]}+${extra}'` : `${leak[1]}+'`;
  }
  const stripped = nm.replace(/\s+\d{1,3}\s*\+\s*\d*\s*'?\s*$/, '').replace(/\s+\d{1,3}\s*'?\s*$/, '').trim();
  return { name: stripped || nm, minute: min };
}

export const surname = name =>
  stripAccents((name || '').toLowerCase()).replace(/\s+/g, ' ').trim().split(' ').pop();

/* "K. Mbappé" and "Kylian Mbappé" are one player: same surname, and the
   short form's initial matches the full first name */
export function isAbbreviationOf(short, full){
  const s = short.trim().split(/\s+/), f = full.trim().split(/\s+/);
  return s.length === 2 && /^\p{L}\.$/u.test(s[0]) && f.length >= 2 && surname(short) === surname(full)
    && stripAccents(s[0][0].toLowerCase()) === stripAccents(f[0][0].toLowerCase());
}

/* ---- garbled player-name repair ----
   The scores feed mangles names ("Kvdi Khakpv" = Kai Havertz) but mostly keeps
   consonant shape. Lineups from the extra feed carry the correct names, so we
   fuzzy-match each garbled name against that team's squad. No confident match
   → keep the original, so nothing is ever lost. */
const letters = s => stripAccents((s || '').toLowerCase()).replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
const skeleton = s => letters(s).replace(/[aeiou\s]/g, '');

function lcsLen(a, b){
  if(!a.length || !b.length) return 0;
  let prev = new Array(b.length + 1).fill(0), cur = prev.slice();
  for(let i = 1; i <= a.length; i++){
    for(let j = 1; j <= b.length; j++)
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
const overlap = (a, b) => (2 * lcsLen(a, b)) / (a.length + b.length);

function nameSim(garbled, candidate){
  const gs = skeleton(garbled), cs = skeleton(candidate);
  if(!gs || !cs) return 0;
  let sc = overlap(gs, cs);
  const gl = letters(garbled).replace(/\s/g, ''), cl = letters(candidate).replace(/\s/g, '');
  if(gl && cl) sc += 0.4 * overlap(gl, cl);
  const gTok = letters(garbled).split(' '), cTok = letters(candidate).split(' ');
  const gLast = gTok.at(-1) || '', cLast = cTok.at(-1) || '';
  if(skeleton(gLast) && skeleton(gLast) === skeleton(cLast)) sc += 0.35;
  if(gLast[0] && gLast[0] === cLast[0]) sc += 0.08;
  if(gTok.length === cTok.length) sc += 0.05;
  return sc;
}

export function bestSquadMatch(garbled, squad){
  if(!garbled || !squad?.length) return null;
  let best = null, bestSc = -1, second = -1;
  for(const c of squad){
    const s = nameSim(garbled, c);
    if(s > bestSc){ second = bestSc; bestSc = s; best = c; }
    else if(s > second) second = s;
  }
  /* within one ~14-player lineup the real player usually wins clearly;
     keep a margin so we never guess between two similar teammates */
  return bestSc >= 0.55 && (bestSc - second >= 0.04 || bestSc >= 0.85) ? best : null;
}
