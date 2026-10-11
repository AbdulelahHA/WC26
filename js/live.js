/* Loads a tournament's data files, polls the two Workers and rebuilds the
   model. If the scores Worker is unreachable before we ever had data, the
   tournament's archived feed snapshot is used, so a finished tournament keeps
   working even after its upstream source disappears. */
import { buildResults } from './logic/feed.js';
import { buildModel } from './logic/model.js';
import { IN_PLAY } from './logic/status.js';
import { state, update } from './store.js';

const SCORES_EVERY = 60e3, EXTRA_EVERY = 120e3;
export const GOAL_FX_MS = 30e3;
/* "<matchId>|h" -> when that side scored; drives the 30s GOOOAAALLL band */
export const goalFx = new Map();

let base = '', scores = null, extra = null;

const getJSON = async url => {
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};
const fresh = url => url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();

export async function loadTournament(id){
  base = `tournaments/${id}/`;
  const [tournament, teams, fixtures, history, aliases] = await Promise.all(
    ['tournament', 'teams', 'fixtures', 'history', 'aliases'].map(f => getJSON(base + f + '.json')));
  return { tournament, teams, fixtures, history, aliases };
}

function rebuild(){
  const { data } = state;
  const feed = buildResults(scores, extra, data.teams, data.aliases);
  if(feed.unmatched.length) console.warn('[WC26] Unmatched team names from feed:', feed.unmatched);
  const model = buildModel(data, feed, Date.now());
  detectGoals(state.model, model);
  update({ model });
}

/* a side's score went up while the match is in play → celebrate it */
function detectGoals(prev, next){
  if(!prev) return;
  for(const m of next.matches){
    const was = prev.byId.get(m.id)?.result;
    if(!was || !m.result || !IN_PLAY.has(m.state)) continue;
    if((m.result.homeScore ?? 0) > (was.homeScore ?? 0)) goalFx.set(m.id + '|h', Date.now());
    if((m.result.awayScore ?? 0) > (was.awayScore ?? 0)) goalFx.set(m.id + '|a', Date.now());
  }
}

async function pollScores(){
  try{
    scores = await getJSON(fresh(state.data.tournament.feeds.scores));
    update({ feed: 'ok' });
  }catch{
    if(scores) return;          /* keep the last good data; the next poll is the retry */
    try{ scores = await getJSON(base + state.data.tournament.feeds.archive); update({ feed: 'ok' }); }
    catch{ update({ feed: 'err' }); return; }
  }
  rebuild();
}

async function pollExtra(){
  try{ extra = await getJSON(fresh(state.data.tournament.feeds.extra)); }
  catch{ return; }              /* optional layer: failing never affects scores */
  if(scores) rebuild();
}

export function startFeeds(){
  rebuild();                    /* render fixtures straight away, before any feed arrives */
  pollScores(); pollExtra();
  setInterval(pollScores, SCORES_EVERY);
  setInterval(pollExtra, EXTRA_EVERY);
}
