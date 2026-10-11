/* What state is a match in, right now? One definition, used by every view. */

export const IN_PLAY = new Set(['LIVE', 'HT', 'ET', 'PEN']);
export const FINISHED = new Set(['FT', 'AET', 'AP']);
export const MATCH_LEN = 2.25 * 3600e3;     /* treated as live for ~2h15 after kickoff when there's no feed */
const EARLY_GRACE = 10 * 60e3;

/* the upstream feed sometimes flips a match to LIVE hours before kickoff
   (a timezone bug on their side). Matches start late, never early. */
export function effectiveState(result, kickoff, now){
  const st = result?.state || 'NS';
  return IN_PLAY.has(st) && now < kickoff - EARLY_GRACE ? 'NS' : st;
}

/* 'h' | 'a' | null — level after extra time goes to the shootout score */
export function winnerSide(r){
  if(!r || !FINISHED.has(r.state)) return null;
  let h = r.homeScore ?? 0, a = r.awayScore ?? 0;
  if(r.state === 'AP' && h === a && r.penHome != null && r.penAway != null){ h = r.penHome; a = r.penAway; }
  return h > a ? 'h' : a > h ? 'a' : null;
}

/* ---- live clock ----
   The scores feed carries no minute, so it's estimated from kickoff:
   1'..45', then 45+N through the break, then the second half — anchored to
   the moment we saw HT turn back into LIVE, when we saw it. */
const KO_DELAY = 90e3, STOPPAGE_CAP = 15;

export function clockFromKickoff(kickoff, now){
  const min = Math.floor((now - (kickoff + KO_DELAY)) / 60e3);
  if(min < 1) return { label: "1'", ht: false };
  if(min <= 45) return { label: min + "'", ht: false };
  if(min < 60) return { label: `45+${Math.min(min - 45, STOPPAGE_CAP)}`, ht: true };
  const second = min - 15;
  if(second < 46) return { label: "46'", ht: false };
  if(second <= 90) return { label: second + "'", ht: false };
  return { label: `90+${Math.min(second - 90, STOPPAGE_CAP)}`, ht: false };
}

export function secondHalfLabel(anchor, kickoff, now){
  if(!anchor) return clockFromKickoff(kickoff, now).label;
  const mins = 45 + Math.floor((now - anchor) / 60e3);
  return mins <= 90 ? mins + "'" : `90+${Math.min(mins - 90, STOPPAGE_CAP)}`;
}
