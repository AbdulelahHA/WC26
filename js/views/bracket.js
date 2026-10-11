/* Radial knockout bracket (SVG) + its fullscreen pinch/pan/zoom view.
   The tree comes from the fixtures: leaves are the first knockout round
   (left/right halves from config), each later match joins its two "W" feeders. */
import { state } from '../store.js';
import { t, teamName, flagCode, roundShort, esc } from '../i18n.js';

const SZ = 1000, CX = 500, CY = 500, R_TEAM = 452, D2R = Math.PI / 180;
const pt = (r, a) => [CX + r * Math.cos(a * D2R), CY + r * Math.sin(a * D2R)];

export function bracketSVG(){
  const { model, data, favs } = state;
  const { bracket, rounds } = data.tournament;
  const fx = new Map(data.fixtures.map(f => [f.id, f]));
  const feeders = id => [fx.get(id).home, fx.get(id).away].filter(s => s[0] === 'W').map(s => +s.slice(1));

  /* ring radius per round, outer (first KO round) to inner (semis) */
  const ringRounds = rounds.filter(r => r !== 'third' && r !== 'final');
  const radii = ringRounds.length === 4 ? [366, 276, 188, 108]
    : ringRounds.map((_, i) => 366 - i * (366 - 108) / Math.max(1, ringRounds.length - 1));
  const R = Object.fromEntries(ringRounds.map((r, i) => [r, radii[i]]));

  /* leaf angles: each half fans down its side of the circle from the top gap */
  const GAP = 15, n = bracket.left.length, sect = (360 - 2 * GAP) / 2 / n;
  const ANG = {}, RAD = {};
  const norm = a => ((a % 360) + 360) % 360;
  bracket.left.forEach((id, i) => { ANG[id] = norm(270 - GAP / 2 - (i + 0.5) * sect); RAD[id] = R[fx.get(id).stage]; });
  bracket.right.forEach((id, i) => { ANG[id] = norm(270 + GAP / 2 + (i + 0.5) * sect); RAD[id] = R[fx.get(id).stage]; });
  const midAng = (a, b) => { const d = ((b - a + 540) % 360) - 180; return norm(a + d / 2); };
  /* inner nodes sit between their feeders; walk up from the final */
  const place = id => {
    if(ANG[id] != null) return;
    const [a, b] = feeders(id); place(a); place(b);
    ANG[id] = midAng(ANG[a], ANG[b]); RAD[id] = R[fx.get(id).stage];
  };
  const [sfA, sfB] = feeders(bracket.final);
  place(sfA); place(sfB);

  const won = id => model.winner[id] ?? null;
  const eliminated = new Set(Object.values(model.loser));
  const fav = new Set(favs);
  let lines = '', nodes = '', chips = '';
  const conn = (r1, a1, r2, a2, w) => {
    const [x1, y1] = pt(r1, a1), [x2, y2] = pt(r2, a2);
    return `<path class="kr-line${w ? ' won' : ''}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  };
  const chip = (code, a, right, w, id) => {
    const [x, y] = pt(R_TEAM, a), fw = 44, fh = 30;
    const tx = right ? fw / 2 + 8 : -(fw / 2 + 8), anchor = right ? 'start' : 'end';
    const nm = code ? esc(teamName(code)) : '—';
    const starX = right ? tx + Math.min(nm.length * 8.4 + 10, 150) : tx - Math.min(nm.length * 8.4 + 10, 150);
    const cls = ['kr-chip', w && 'won', !code && 'tbd', eliminated.has(code) && 'out', fav.has(code) && 'fav'].filter(Boolean).join(' ');
    return `<g class="${cls}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" data-m="${id}" data-code="${code || ''}">
      <rect class="kr-flagbg" x="${-fw / 2 - 3}" y="${-fh / 2 - 3}" width="${fw + 6}" height="${fh + 6}" rx="5"/>
      ${code ? `<image href="https://flagcdn.com/h60/${flagCode(code)}.png" x="${-fw / 2}" y="${-fh / 2}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMid slice"/>` : ''}
      <text class="kr-nm" x="${tx}" y="1" text-anchor="${anchor}" dominant-baseline="middle">${nm}</text>
      ${fav.has(code) ? `<text class="kr-fav-star" x="${starX.toFixed(0)}" y="1" text-anchor="${anchor}" dominant-baseline="middle">★</text>` : ''}
    </g>`;
  };

  /* leaves: two team chips each, wired to the match node */
  for(const [ids, right] of [[bracket.left, false], [bracket.right, true]]) for(const id of ids){
    const m = model.byId.get(id), w = won(id), off = sect * 0.3;
    lines += conn(R_TEAM - 26, ANG[id] - off, RAD[id], ANG[id], w && w === m.home);
    lines += conn(R_TEAM - 26, ANG[id] + off, RAD[id], ANG[id], w && w === m.away);
    chips += chip(m.home, ANG[id] - off, right, w && w === m.home, id);
    chips += chip(m.away, ANG[id] + off, right, w && w === m.away, id);
  }
  /* every placed node, plus a line from each feeder to its parent */
  for(const id of Object.keys(ANG).map(Number)){
    const [x, y] = pt(RAD[id], ANG[id]);
    nodes += `<circle class="kr-node ${won(id) ? 'won' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`;
    for(const f of fx.get(id).stage === ringRounds[0] ? [] : feeders(id)) lines += conn(RAD[f], ANG[f], RAD[id], ANG[id], !!won(f));
  }
  for(const sf of [sfA, sfB]) lines += conn(RAD[sf], ANG[sf], 60, ANG[sf], !!won(sf));

  /* the cup at the centre; crowned with rays + flag once the final is decided */
  const champ = model.champion;
  const rays = champ ? Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * D2R;
    return `<line class="kr-ray" x1="${(70 * Math.cos(a)).toFixed(1)}" y1="${(70 * Math.sin(a)).toFixed(1)}" x2="${(96 * Math.cos(a)).toFixed(1)}" y2="${(96 * Math.sin(a)).toFixed(1)}"/>`;
  }).join('') : '';
  const trophy = `<g class="kr-cup${champ ? ' crowned' : ''}" transform="translate(${CX},${CY})">
    <circle r="64" fill="url(#cupGlow)"/>${rays}
    <g transform="translate(-26,-30) scale(2.2)">
      <path fill="url(#goldStroke)" stroke="#7a5a1e" stroke-width=".4" d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/>
    </g>
    ${champ ? `<text class="kr-champ-lbl" y="-46" text-anchor="middle">${esc(t('championTitle'))}</text>
    <text class="kr-champ" y="44" text-anchor="middle">${esc(teamName(champ))}</text>
    <image href="https://flagcdn.com/h60/${flagCode(champ)}.png" x="-22" y="52" width="44" height="30" preserveAspectRatio="xMidYMid slice"/>`
    : `<text class="kr-champ-lbl" y="44" text-anchor="middle">${t('champion')}</text>`}
  </g>`;

  const rings = ringRounds.map(r => `<circle class="kr-ring" cx="${CX}" cy="${CY}" r="${R[r]}"/>
    <text class="kr-ring-lbl" x="${CX}" y="${(CY - R[r] - 6).toFixed(0)}" text-anchor="middle">${roundShort(r)}</text>`).join('');
  const PAD = 40, VB0 = CX - (R_TEAM + PAD), VBSZ = 2 * (R_TEAM + PAD);
  return `<svg class="kr-svg" viewBox="${VB0} ${VB0} ${VBSZ} ${VBSZ}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Knockout bracket">
    <defs>
      <radialGradient id="cupGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(227,197,103,.32)"/><stop offset="40%" stop-color="rgba(185,138,46,.12)"/><stop offset="100%" stop-color="rgba(185,138,46,0)"/>
      </radialGradient>
      <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f4dd8e"/><stop offset="100%" stop-color="#b8862e"/></linearGradient>
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${R_TEAM - 60}" fill="url(#cupGlow)"/>
    <g class="kr-guides">${rings}</g>
    <g class="kr-lines">${lines}</g>
    <g class="kr-nodes">${nodes}</g>
    ${trophy}
    <g class="kr-chips">${chips}</g>
  </svg>`;
}

/* ---- fullscreen: pinch-zoom, pan, wheel zoom, double-tap reset ---- */
const view = { s: 1, x: 0, y: 0, min: 0.5, max: 6, pts: new Map(), lastDist: 0, lastTap: 0 };
const $ = id => document.getElementById(id);
const apply = () => { $('kr-full-stage').style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; };
function fit(){
  const vp = $('kr-full-vp'), side = Math.min(vp.clientWidth, vp.clientHeight);
  const svg = $('kr-full-stage').querySelector('svg');
  if(svg){ svg.style.width = side + 'px'; svg.style.height = side + 'px'; }
  Object.assign(view, { s: 1, x: (vp.clientWidth - side) / 2, y: (vp.clientHeight - side) / 2 });
  apply();
}
export function openFullscreen(){
  const src = document.querySelector('.kr-wrap .kr-svg');
  if(!src) return;
  $('kr-full-stage').innerHTML = src.outerHTML;
  $('kr-full').hidden = false;
  document.body.style.overflow = 'hidden';
  fit();
}
function close(){
  $('kr-full').hidden = true;
  document.body.style.overflow = '';
  view.pts.clear();
}
export function initFullscreen(){
  const full = $('kr-full'), vp = $('kr-full-vp');
  $('kr-full-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !full.hidden) close(); });
  addEventListener('resize', () => { if(!full.hidden) fit(); });
  /* zoom about a screen point: that point stays fixed while scale changes */
  const zoomAt = (px, py, f) => {
    const ns = Math.min(view.max, Math.max(view.min, view.s * f)), k = ns / view.s;
    view.x = px - k * (px - view.x); view.y = py - k * (py - view.y); view.s = ns;
    apply();
  };
  vp.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  vp.addEventListener('pointerdown', e => {
    vp.setPointerCapture(e.pointerId);
    view.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    vp.classList.add('grabbing');
    const now = Date.now();
    if(now - view.lastTap < 300 && view.pts.size === 1) fit();
    view.lastTap = now;
    if(view.pts.size === 2){ const [a, b] = view.pts.values(); view.lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  vp.addEventListener('pointermove', e => {
    const prev = view.pts.get(e.pointerId);
    if(!prev) return;
    view.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if(view.pts.size === 1){ view.x += e.clientX - prev.x; view.y += e.clientY - prev.y; apply(); }
    else if(view.pts.size === 2){
      const [a, b] = view.pts.values(), dist = Math.hypot(a.x - b.x, a.y - b.y);
      if(view.lastDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / view.lastDist);
      view.lastDist = dist;
    }
  });
  const lift = e => {
    view.pts.delete(e.pointerId);
    if(view.pts.size < 2) view.lastDist = 0;
    if(!view.pts.size) vp.classList.remove('grabbing');
  };
  vp.addEventListener('pointerup', lift);
  vp.addEventListener('pointercancel', lift);
}
