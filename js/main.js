/* Boot: load the tournament, wire the views, start the feeds and the clock.
   Pick another tournament with ?t=<folder>, e.g. ?t=afc2027. */
import { state, subscribe } from './store.js';
import { setTimezone } from './time.js';
import { loadTournament, startFeeds } from './live.js';
import { initShell, applyChrome, applyTheme, showPage, feedStatus } from './views/shell.js';
import { initSchedule, renderSchedule, tick, greetToday } from './views/schedule.js';
import { initStandings, renderStandings, focusGroup } from './views/standings.js';
import { initStats, renderStats } from './views/stats.js';
import { initFavorites, renderFavorites, renderPicker, pickerOpen } from './views/favorites.js';
import { initFullscreen } from './views/bracket.js';
import { startBall, showPhrase } from './views/fx.js';

const id = new URLSearchParams(location.search).get('t') || 'wc2026';
state.data = await loadTournament(id);
setTimezone(state.data.tournament.timezone);

function render(){
  if(!state.model) return;
  renderSchedule();
  renderFavorites();
  renderStandings();
  renderStats();
}

let greeted = false;
subscribe(patch => {
  if('theme' in patch || 'pal' in patch) applyTheme();
  if('lang' in patch){ applyChrome(); if(pickerOpen()) renderPicker(); }
  if('page' in patch) showPage();
  if('feed' in patch || 'model' in patch || 'lang' in patch) feedStatus();
  render();
  if(patch.focusGroup) focusGroup(patch.focusGroup);
  if(!greeted && state.feed === 'ok' && 'model' in patch){ greeted = true; greetToday(); }
});

applyChrome();
applyTheme();
initShell();
initSchedule();
initStandings();
initStats();
initFavorites();
initFullscreen();
startFeeds();
setInterval(tick, 1000);
startBall();
showPhrase(state.data.tournament.phrases);
