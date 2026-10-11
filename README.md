# WC26 — live tournament scores

Static site (GitHub Pages), no build step. Native ES modules + plain CSS.
Live data comes from two Cloudflare Workers; if the scores Worker is down,
the tournament's archived feed (`archive.json`) is used instead.

## Layout

```
index.html                markup only
css/                      tokens → layout → schedule → standings → nav → stats → responsive (cascade order matters)
js/main.js                boot: load tournament, wire views, start feeds + 1s clock
js/store.js               the only mutable state; views subscribe to it
js/live.js                load tournament files, poll Workers, rebuild the model
js/logic/                 PURE (no DOM) — tested in Node
  feed.js                 Worker payloads → results keyed by team codes
  names.js                team-name resolution, garbled player-name repair
  status.js               match state, winner, live-clock estimate
  standings.js            group tables, best-third qualification
  model.js                fixtures + results → matches, tables, resolved knockout
  stats.js                scorers, assists, clean sheets, totals
js/views/                 one file per page/component, read the model, write the DOM
tournaments/<id>/         everything tournament-specific (data, not code)
tests/                    node --test, runs the real pipeline on the archived feed
```

## Run

```
npx serve .        # or any static server — ES modules don't load from file://
npm test
```

## Add a tournament (e.g. AFC Asian Cup 2027)

Copy `tournaments/wc2026/` to `tournaments/afc2027/` and edit the data:

- `tournament.json` — timezone, feed URLs, hosts, venues, rounds, bracket halves
  (`left`/`right` = first knockout round in ring order), `thirdPlace`
  (`qualify`, `slotMatches`, `table` — the official lookup for best thirds), text.
- `teams.json` — code → `en`, `ar`, flag code, region, pattern.
- `fixtures.json` — every match: `id`, `stage`, `group`, `kickoff` (UTC ISO), `venue`,
  `home`/`away` as team codes, or slots: `1A` winner, `2B` runner-up,
  `3:ABCDF` best third, `W49` / `L49` winner/loser of a match.
- `history.json`, `aliases.json` (feed name → our name).

Open with `?t=afc2027`.
