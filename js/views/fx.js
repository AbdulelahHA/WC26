/* Decorative motion: winner confetti, the descending ball, the hero phrase. */
const GOLDS = ['#E3C567', '#F7ECC4', '#B98A2E', '#D9B65A', '#FFE9A8'];
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* golden confetti from the winning half of a decided match */
export function burst(matchEl){
  const win = matchEl.querySelector('.half.win');
  if(!win || calm()) return;
  const mr = matchEl.getBoundingClientRect(), hr = win.getBoundingClientRect();
  const x = hr.left - mr.left + hr.width / 2, y = hr.top - mr.top + hr.height / 2;
  const N = 22;
  for(let i = 0; i < N; i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `background:${GOLDS[i % GOLDS.length]};left:${x}px;top:${y}px`;
    matchEl.appendChild(p);
    const ang = Math.PI * 2 * (i / N) + Math.random() * 0.5, vel = 40 + Math.random() * 70;
    const dx = Math.cos(ang) * vel, dy = Math.sin(ang) * vel - (30 + Math.random() * 40);
    const dur = 750 + Math.random() * 650;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px,${dy + 60}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => p.remove();
  }
}

/* the ball zig-zags down the viewport as the page scrolls */
export function startBall(){
  const ball = document.getElementById('wc-ball');
  if(!ball) return;
  let target = 0, current = 0;
  const compute = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    target = Math.min(1, Math.max(0, scrollY / max));
  };
  const frame = () => {
    current += (target - current) * 0.08;
    const amp = Math.min(innerWidth * 0.34, 260);
    const x = innerWidth / 2 - 23 + Math.sin(current * Math.PI * 5) * amp;
    ball.style.transform = `translate(${x}px,${current * (innerHeight - 70) + 12}px)`;
    requestAnimationFrame(frame);
  };
  addEventListener('scroll', compute, { passive: true });
  addEventListener('resize', compute);
  compute(); frame();
}

export function showPhrase(phrases){
  const el = document.getElementById('wc-phrase');
  if(el && phrases?.length) el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
}
