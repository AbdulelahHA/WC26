# WC26 — World Cup 2026 live scores

**Live:** https://abdulelahha.github.io/WC26/

A fan-made live-score site for the **FIFA World Cup 2026** (48 teams, 104 matches,
USA · Mexico · Canada). Schedule, live scores, group tables, a radial knockout bracket,
penalty shootouts and tournament stats — in **English and Arabic (RTL)**, every time
shown in **Mecca time**, with night/light themes and colour palettes. Unofficial personal
project; not affiliated with FIFA.

## Context

WC26 ran live through the whole tournament. Its engine now also powers the
[AFC Asian Cup 2027 site](https://github.com/AbdulelahHA/AFC2027): the same `js/logic/`
code, pointed at a different tournament folder.

What the site does:

- **Schedule** — every match by day, live state (NS / LIVE / HT / FT / AET / AP) and an
  estimated minute; tap a match for goals, assists, penalty shootout kick by kick, cards
  and squads. A 30-second "goal" band when a side scores.
- **Standings** — 12 group tables, the best-third ranking (8 of 12 go through), and a
  radial knockout bracket with a full-screen view.
- **Stats** — top scorers, assists, clean sheets, tournament totals and history.
- **Settings** — language, theme, palette, and favourite teams pinned to the top.

## How it works

```
Worker "wc2026-scores" (60 s) ──┐
Worker "wc2026-extra" (120 s) ──┼─► js/live.js ─► js/logic/ (feed → model) ─► store ─► views
tournaments/wc2026/*.json ──────┘
```

- **Static site, no backend, no build step.** `index.html` + native ES modules + plain
  CSS, served by GitHub Pages.
- **Live data comes from two Cloudflare Workers** (URLs in `tournament.json`): one for
  scores and goals, one for lineups, assists and cards. The browser never holds an API key.
- **If the scores Worker is down**, the tournament's archived feed (`archive.json`) is
  used, so the finished tournament keeps working after its upstream source goes away.
- **Feed quirks are boxed into `js/logic/feed.js` and `names.js`**: team-name aliases,
  garbled player-name repair, and merging duplicates ("K. Mbappé" + "Kylian Mbappé").
  Everything after that keys on team codes.
- **The knockout bracket is computed**, not hardcoded: group tables + FIFA's best-third
  table → Round of 32, then winners onward. The test suite checks it against FIFA's
  official Round-of-32 draw (`tests/r32-official.json`).

## How it was built

1. **Version 1 (summer 2026)** — one `index.html` of about 5,000 lines with inline CSS and
   JS, built during the tournament. Data was joined to the schedule by team name, which
   forced a pile of aliasing, name-repair and hardcoded fallback results. A GitHub Actions
   cron also fetched football-data.org into `scores.json` every 2 minutes, but the page had
   stopped reading it (1,500+ bot commits).
2. **Analysis (Oct 2026)** — the old app was reverse-engineered to find what it really did
   and where its data came from, and a rebuild spec was written: keep every feature, make
   the code tournament-agnostic so AFC 2027 and World Cup 2030 are just new data folders.
3. **Rebuild (11 Oct 2026)** — 5,000 lines became a 270-line `index.html`, 7 CSS files,
   ~20 JS modules and tournament JSON. Logic is pure and runs in Node; views only read the
   model and write the DOM. Verified against the old site in a headless browser (same
   schedule, results, tables, bracket and stats). Building it surfaced two bugs in the old
   site: Mbappé is the real top scorer with 9 (his goals were split across two spellings),
   and the old bracket drew broken lines.
4. **Deploy (12 Oct 2026)** — the score-bot workflow was removed; every push to `main` now
   runs the tests and deploys to Pages only if they pass
   ([.github/workflows/pages.yml](.github/workflows/pages.yml)).

## Run

```
npx serve .        # or any static server — ES modules don't load from file://
npm test
```

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

## Add a tournament

Copy `tournaments/wc2026/` to `tournaments/<id>/` and edit the data:

- `tournament.json` — timezone, feed URLs, hosts, venues, rounds, bracket halves
  (`left`/`right` = first knockout round in ring order), `thirdPlace`
  (`qualify`, `slotMatches`, `table` — the official lookup for best thirds), text.
- `teams.json` — code → `en`, `ar`, flag code, region, pattern.
- `fixtures.json` — every match: `id`, `stage`, `group`, `kickoff` (UTC ISO), `venue`,
  `home`/`away` as team codes, or slots: `1A` winner, `2B` runner-up,
  `3:ABCDF` best third, `W49` / `L49` winner/loser of a match.
- `history.json`, `aliases.json` (feed name → our name).

Open with `?t=<id>`. AFC 2027 was built this way, in its own repo.
