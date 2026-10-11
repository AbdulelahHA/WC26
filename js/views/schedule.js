/* Schedule page: day cards (group days, then knockout days) built from the
   model, plus a 1-second tick that keeps live states, clocks, countdowns and
   celebrations current without rebuilding the DOM. */
import { state, update } from '../store.js';
import { t, ar, teamName, dayName, monthName, roundLabel, roundShort, regionText, flag, plural } from '../i18n.js';
import { local, countdown } from '../time.js';
import { IN_PLAY, FINISHED, MATCH_LEN, effectiveState, winnerSide, clockFromKickoff, secondHalfLabel } from '../logic/status.js';
import { goalFx, GOAL_FX_MS } from '../live.js';
import { panelHTML, hasLineup } from './match-panel.js';
import { HOSTMARK } from './icons.js';
import { burst } from './fx.js';

const $ = id => document.getElementById(id);
let renderedSig = '';
let collapseInitDone = false;

/* second-half anchors: when we saw HT turn back into LIVE, per match id.
   Persisted so the clock survives reloads mid-match. */
const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const half2 = store('wc26_half2', {}), prevState = store('wc26_prev', {});
const saveTiming = () => { try { localStorage.setItem('wc26_half2', JSON.stringify(half2)); localStorage.setItem('wc26_prev', JSON.stringify(prevState)); } catch {} };

/* ---------------- render ---------------- */

function side(m, code, cls){
  if(!code) return `<div class="half ${cls} tbd"><span class="tname" style="opacity:.5">${t('tbd')}</span></div>`;
  return `<div class="half ${cls}" style="--pbg:${state.data.teams[code].pattern}">${flag(code)}<span class="tname">${teamName(code)}</span></div>`;
}

function matchHTML(m){
  const { venues, spotlight } = state.data.tournament;
  const v = venues[m.venue], hm = local(m.kickoff).hm;
  const ko = m.stage !== 'group';
  const spot = spotlight && (m.home === spotlight || m.away === spotlight) ? ' sa' : '';
  const tag = ko
    ? `<span class="ko-round-tag" title="${roundLabel(m.stage)}">${roundShort(m.stage)}</span>`
    : `<button class="grp" data-grp="${m.group}" title="${t('goToGroup')} ${m.group}">${m.group}</button>`;
  return `<div class="match${ko ? ' ko-match' : ''}${spot}" data-id="${m.id}" data-utc="${m.kickoff}" data-kick="${hm}" data-ha="${m.home || ''}" data-hb="${m.away || ''}">
    <div class="m-row">
      ${side(m, m.home, 'left')}
      <div class="mid"><div class="ktime">${hm}</div>${tag}</div>
      ${side(m, m.away, 'right')}
    </div>
    <div class="loc host-${v.host}"><span class="host-mark">${HOSTMARK[v.host] || ''}</span><b>${v.name}</b> — ${regionText(v.region)}</div>
    <div class="goals-panel" hidden></div>
  </div>`;
}

function dayHTML(key, list, ko){
  const p = local(list[0].kickoff);
  return `<section class="day${ko ? ' ko-day' : ''}" id="${ko ? 'koday' : 'day'}-${key}" data-key="${key}">
    <div class="day-head">
      <div class="date-block">
        <div class="date-num">${p.d}</div>
        <div><span class="weekday">${dayName(p.weekday)}</span><span class="month">${monthName(p.mo)}</span></div>
      </div>
      <span class="day-summary"><span class="ds-count">${list.length} ${plural(list.length, 'match', 'matches')}</span><span class="ds-status"></span></span>
      <span class="head-extra"></span>
    </div>
    <div class="matches-body">${list.map(matchHTML).join('')}</div>
  </section>`;
}

/* rebuild only when the teams on the cards (or the language) change —
   score/state updates are the tick's job, so open panels and scroll survive */
export function renderSchedule(){
  const { model } = state;
  const sig = state.lang + model.matches.map(m => `${m.id}:${m.home}>${m.away}`).join('|');
  if(sig !== renderedSig){
    renderedSig = sig;
    const days = { g: new Map(), k: new Map() };
    for(const m of model.matches){
      const map = days[m.stage === 'group' ? 'g' : 'k'], key = local(m.kickoff).key;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    const host = $('schedule');
    const open = new Set([...host.querySelectorAll('.day:not(.collapsed)')].map(d => d.id));
    const openMatch = host.querySelector('.match.open');
    const reopen = openMatch && { id: openMatch.dataset.id, mode: openMatch.querySelector('.exp-tab.on')?.dataset.exp };
    host.innerHTML = [...days.g].map(([k, l]) => dayHTML(k, l, false)).join('')
      + `<div id="ko-schedule-wrap" style="grid-column:1 / -1">${[...days.k].map(([k, l]) => dayHTML(k, l, true)).join('')}</div>`;
    if(collapseInitDone) host.querySelectorAll('.day').forEach(d => d.classList.toggle('collapsed', !open.has(d.id)));
    if(reopen) expand(host.querySelector(`.match[data-id="${reopen.id}"]`), reopen.mode);
  }else{
    /* same cards: refresh any open panel with the new data, keeping its view */
    const open = $('schedule').querySelector('.match.open');
    if(open) expand(open, open.querySelector('.exp-tab.on')?.dataset.exp);
  }
  tick();
}

/* ---------------- tick (every second) ---------------- */

function setMid(el, score, liveTag, ftTag, penText){
  const mid = el.querySelector('.mid');
  const tag = mid.querySelector('.grp, .ko-round-tag')?.outerHTML || '';
  let kt;
  if(score == null) kt = `<div class="ktime">${el.dataset.kick}</div>`;
  else if(ftTag) kt = `<div class="ktime score">${score}${penText ? `<span class="pen-score">${penText}</span>` : ''}<small>${ftTag}</small></div>`;
  else if(score === '') kt = `<div class="ktime clock-only">${liveTag}</div>`;   /* no feed: running clock only */
  else kt = `<div class="ktime">${score}<span class="live-tag">${liveTag}</span></div>`;
  if(mid.dataset.html !== kt){ mid.innerHTML = kt + tag; mid.dataset.html = kt; }
}

function liveLabel(m, st, now){
  if(st === 'ET') return m.result.minute ? m.result.minute + "'" : t('extraTime');
  if(st === 'PEN') return t('penalties');
  return half2[m.id] || now - m.kickoff >= 60 * 60e3 ? secondHalfLabel(half2[m.id], m.kickoff, now) : clockFromKickoff(m.kickoff, now).label;
}

function tickMatch(el, m, now){
  const st = effectiveState(m.result, m.kickoff, now);
  let live = now >= m.kickoff && now < m.kickoff + MATCH_LEN, done = now >= m.kickoff + MATCH_LEN, ht = false;

  if(m.result){
    /* detect HT → play restart once, to anchor the second-half clock */
    if(st === 'LIVE' && prevState[m.id] === 'HT' && !half2[m.id]) half2[m.id] = now;
    if(FINISHED.has(st)) delete half2[m.id];
    prevState[m.id] = st;

    live = ['LIVE', 'ET', 'PEN'].includes(st); ht = st === 'HT'; done = FINISHED.has(st);
    if(!IN_PLAY.has(st) && !done) setMid(el, null);
    if(live || ht) setMid(el, `${m.result.homeScore ?? 0} – ${m.result.awayScore ?? 0}`, ht ? t('halfTime') : liveLabel(m, st, now));
    if(done){
      const r = m.result;
      const tag = st === 'AP' ? t('pensTag') : st === 'AET' ? t('aet') : t('ft');
      const pens = st === 'AP' && r.penHome != null ? `(${r.penHome}-${r.penAway} ${t('pens')})` : null;
      setMid(el, `${r.homeScore} – ${r.awayScore}`, null, tag, pens);
      const w = winnerSide(r), halves = el.querySelectorAll('.half');
      halves[0].classList.toggle('win', w === 'h');
      halves[1].classList.toggle('win', w === 'a');
    }
  }else if(live && m.home){
    const clk = clockFromKickoff(m.kickoff, now);
    if(clk.ht){ live = false; ht = true; }
    setMid(el, '', clk.ht ? t('halfTime') : clk.label);
  }

  el.classList.toggle('live', live);
  el.classList.toggle('ht', ht);
  el.classList.toggle('done', done);
  el.classList.toggle('expandable', live || ht || done || hasLineup(m));

  /* GOOOAAALLL band on the side that just scored, for 30s */
  for(const [s, cls] of [['h', 'left'], ['a', 'right']]){
    const half = el.querySelector('.half.' + cls), at = goalFx.get(m.id + '|' + s);
    const band = half.querySelector('.goal-band');
    if(at && now - at < GOAL_FX_MS){
      if(!band) half.insertAdjacentHTML('beforeend', `<div class="goal-band"><span class="gb-text">${t('goalShout')} ${teamName(s === 'h' ? m.home : m.away)}</span></div>`);
    }else{
      band?.remove();
      if(at) goalFx.delete(m.id + '|' + s);
    }
  }
  return { live, ht, done, inPlay: IN_PLAY.has(st) };
}

export function tick(){
  const { model } = state;
  if(!model) return;
  const now = Date.now(), todayKey = local(now).key;
  let todayCard = null;

  for(const card of document.querySelectorAll('#page-schedule .day')){
    const els = [...card.querySelectorAll('.match')];
    const ms = els.map(el => model.byId.get(+el.dataset.id));
    const isToday = card.dataset.key === todayKey;
    const isPast = !isToday && now > Math.max(...ms.map(m => m.kickoff)) + MATCH_LEN;
    const isFuture = !isToday && now < Math.min(...ms.map(m => m.kickoff));
    card.classList.toggle('today', isToday);
    card.classList.toggle('past', isPast);
    card.classList.toggle('future', isFuture);
    if(isToday) todayCard = card;

    const ds = card.querySelector('.ds-status');
    ds.className = 'ds-status' + (isToday ? '' : isPast ? ' played' : ' upcoming');
    ds.textContent = isToday ? '' : isPast ? t('played') : t('upcoming');

    let next = null, anyLive = false;
    els.forEach((el, i) => {
      const s = tickMatch(el, ms[i], now);
      anyLive ||= s.inPlay;
      el.classList.remove('next');
      if(isToday && !next && !s.live && !s.done && !s.ht) next = el;
    });
    /* past & future start collapsed; today and any day with play in progress never are */
    if(!collapseInitDone) card.classList.toggle('collapsed', !(isToday || anyLive));
    if(isToday || anyLive) card.classList.remove('collapsed');

    /* today badge + countdown chip on the single next match */
    const he = card.querySelector('.head-extra');
    card.querySelectorAll('.match-cd').forEach(c => { if(c.parentElement !== next) c.remove(); });
    if(isToday){
      if(!he.querySelector('.today-badge')) he.innerHTML = `<span class="today-badge">${t('today')}</span>`;
      if(next){
        next.classList.add('next');
        const cd = countdown(+next.dataset.utc - now);
        let chip = next.querySelector('.match-cd');
        if(!chip){ chip = document.createElement('div'); chip.className = 'match-cd'; next.appendChild(chip); }
        chip.innerHTML = `<span class="mcd-label">${t('nextKickoff')}</span><b>${cd.d > 0 ? cd.d + t('dayShort') + ' ' : ''}${cd.clock}</b>`;
      }
    }else he.innerHTML = '';
  }
  collapseInitDone = true;

  /* countdown on the favourites' next match */
  for(const el of document.querySelectorAll('.fm-cd')){
    const diff = +el.dataset.utc - now;
    if(diff <= 0){ el.textContent = ''; continue; }
    const cd = countdown(diff);
    el.textContent = cd.d > 0 ? ` · ${cd.d} ${cd.d === 1 ? t('days')[0] : t('days')[1]} ${cd.clock}` : ` · ${cd.clock}`;
  }
  saveTiming();
  markFavorites();
  updateJumpButton(todayCard);
  return todayCard;
}

/* the user's followed teams get a gold accent on every card */
function markFavorites(){
  const fav = new Set(state.favs);
  for(const el of document.querySelectorAll('#schedule .match')){
    const [h, a] = el.querySelectorAll('.half');
    const onH = fav.has(el.dataset.ha), onA = fav.has(el.dataset.hb);
    h.classList.toggle('fav', onH); a.classList.toggle('fav', onA);
    el.classList.toggle('has-fav', onH || onA);
  }
}

/* floating ball: shown when today's card is off-screen, or on other pages */
export function updateJumpButton(today = document.querySelector('#page-schedule .day.today')){
  const btn = $('jump-today');
  if(!today){ btn.hidden = true; return; }
  if(state.page !== 'schedule'){ btn.hidden = false; return; }
  const r = today.getBoundingClientRect(), c = r.top + r.height / 2;
  btn.hidden = c > innerHeight * 0.12 && c < innerHeight * 0.9;
}

/* ---------------- interaction ---------------- */

function expand(el, mode){
  if(!el) return;
  document.querySelectorAll('#schedule .match.open').forEach(o => { if(o !== el) collapse(o); });
  const p = el.querySelector('.goals-panel');
  p.innerHTML = panelHTML(state.model.byId.get(+el.dataset.id), mode, p);
  p.hidden = false;
  el.classList.add('open');
}
function collapse(el){
  const p = el.querySelector('.goals-panel');
  p.hidden = true; p.innerHTML = '';
  el.classList.remove('open');
}

export function initSchedule(){
  const host = $('schedule');
  host.addEventListener('click', e => {
    const tab = e.target.closest('.exp-tab');
    if(tab){ expand(tab.closest('.match'), tab.dataset.exp); return; }
    const subs = e.target.closest('.sq-subs-toggle');
    if(subs){
      const list = subs.closest('.sq-col').querySelector('.sq-subs');
      list.hidden = !list.hidden; subs.classList.toggle('open', !list.hidden);
      return;
    }
    const grp = e.target.closest('.grp');
    if(grp){ update({ page: 'standings', standingsTab: 'groups', focusGroup: grp.dataset.grp }); return; }
    /* tapping a collapsed day's header opens it (accordion); an open one stays open */
    const head = e.target.closest('.day-head');
    if(head){
      const day = head.closest('.day');
      if(day.classList.contains('collapsed')){
        host.querySelectorAll('.day:not(.collapsed):not(.today)').forEach(d => d.classList.add('collapsed'));
        day.classList.remove('collapsed');
      }
      return;
    }
    const el = e.target.closest('.match');
    if(!el) return;
    if(el.querySelector('.half.win')) burst(el);
    if(!el.classList.contains('expandable')) return;
    el.classList.contains('open') ? collapse(el) : expand(el);
  });
  /* hovering a decided match replays its winner's confetti */
  host.addEventListener('mouseover', e => {
    const el = e.target.closest('.match');
    if(el && !el.contains(e.relatedTarget) && el.querySelector('.half.win')) burst(el);
  });

  $('jump-today').addEventListener('click', () => {
    update({ page: 'schedule' });
    setTimeout(() => document.querySelector('#page-schedule .day.today')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  });
  addEventListener('scroll', () => updateJumpButton(), { passive: true });
  addEventListener('resize', () => updateJumpButton(), { passive: true });
}

/* first load: centre today's card and celebrate its already-decided winners */
export function greetToday(){
  const today = document.querySelector('#page-schedule .day.today');
  if(!today) return;
  setTimeout(() => today.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  [...today.querySelectorAll('.match')].filter(m => m.querySelector('.half.win'))
    .forEach((m, i) => setTimeout(() => burst(m), 900 + i * 450));
}
