/* Runs the real pipeline on the archived WC2026 feed. `npm test` */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildResults } from '../js/logic/feed.js';
import { buildModel } from '../js/logic/model.js';
import { cleanGoal, bestSquadMatch } from '../js/logic/names.js';
import { effectiveState, winnerSide } from '../js/logic/status.js';
import { topScorers } from '../js/logic/stats.js';

const load = f => JSON.parse(readFileSync(new URL(f, import.meta.url)));
const dir = '../tournaments/wc2026/';
const data = {
  tournament: load(dir + 'tournament.json'), teams: load(dir + 'teams.json'),
  fixtures: load(dir + 'fixtures.json'), aliases: load(dir + 'aliases.json')
};
const archive = load(dir + 'archive.json');
const feed = buildResults(archive, null, data.teams, data.aliases);
const model = buildModel(data, feed, Date.parse('2026-08-01T00:00:00Z'));

test('every feed team name resolves to a team code', () => {
  assert.deepEqual(feed.unmatched, []);
});

test('all 104 matches get both teams and a finished result', () => {
  assert.equal(model.matches.length, 104);
  const missing = model.matches.filter(m => !m.home || !m.away || !m.result).map(m => m.id);
  assert.deepEqual(missing, []);
  assert.ok(model.matches.every(m => ['FT', 'AET', 'AP'].includes(m.state)));
});

test('computed Round of 32 equals the official FIFA draw', () => {
  const official = load('./r32-official.json');
  for(const [id, pair] of Object.entries(official)){
    const m = model.byId.get(+id);
    assert.deepEqual([m.home, m.away].sort(), [...pair].sort(), `match ${id}`);
  }
});

test('group tables are complete and consistent', () => {
  for(const rows of Object.values(model.tables)){
    assert.ok(rows.every(r => r.P === 3));
    assert.equal(rows.reduce((s, r) => s + r.GD, 0), 0);
  }
  assert.ok(model.champion, 'a champion is resolved');
});

test('top scorers merge a player the feed spells two ways', () => {
  /* the feed has "Kylian Mbappé" (7) and "K. Mbappé" (2) for France */
  const top = topScorers(model);
  const mbappe = top.filter(r => /mbapp/i.test(r.name));
  assert.equal(mbappe.length, 1);
  assert.equal(mbappe[0].goals, 9);
  assert.equal(top[0].name, 'Kylian Mbappé');
});

test('stoppage-time minute leaking onto the name is folded back', () => {
  assert.deepEqual(cleanGoal('Kilian Ambaph 90+', '5'), { name: 'Kilian Ambaph', minute: "90+5'" });
  assert.equal(cleanGoal("K. Mbappe 66'", '66').name, 'K. Mbappe');
});

test('garbled names repair against the squad', () => {
  assert.equal(bestSquadMatch('Kvdi Khakpv', ['Jonathan Tah', 'Kai Havertz', 'Jamal Musiala']), 'Kai Havertz');
  assert.equal(bestSquadMatch('Zzz', ['Jonathan Tah']), null);
});

test('status rules', () => {
  const ko = Date.parse('2026-06-29T20:30:00Z');
  assert.equal(effectiveState({ state: 'LIVE' }, ko, ko - 3600e3), 'NS');   /* premature LIVE ignored */
  assert.equal(effectiveState({ state: 'LIVE' }, ko, ko + 60e3), 'LIVE');
  assert.equal(winnerSide({ state: 'AP', homeScore: 1, awayScore: 1, penHome: 3, penAway: 4 }), 'a');
});
