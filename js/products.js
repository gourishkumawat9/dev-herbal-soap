const nav = document.getElementById('nav');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const onScroll = () => nav.classList.toggle('scrolled', scrollY > 60);
window.addEventListener('scroll', onScroll, {passive: true});
onScroll();

const burger = document.getElementById('burger');
const mob = document.getElementById('mob');
burger.addEventListener('click', () => {
  const open = burger.classList.toggle('open');
  mob.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
document.querySelectorAll('.mob-a').forEach(l => l.addEventListener('click', () => {
  burger.classList.remove('open'); mob.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}));

const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const siblings = [...e.target.parentElement.querySelectorAll(':scope > .rv,:scope > .rl,:scope > .rr')];
    setTimeout(() => e.target.classList.add('in'), siblings.indexOf(e.target) * 90);
    io.unobserve(e.target);
  });
}, {threshold: .12, rootMargin: '0px 0px -48px 0px'});
document.querySelectorAll('.rv,.rl,.rr').forEach(el => io.observe(el));

// category bar: highlight the product on screen and keep its chip in view
const chips = [...document.querySelectorAll('.chip')];
const chipBar = document.querySelector('.chips-in');
const spy = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    chips.forEach(c => {
      const on = c.getAttribute('href') === '#' + e.target.id;
      c.classList.toggle('active', on);
      on ? c.setAttribute('aria-current', 'true') : c.removeAttribute('aria-current');
      if (on) chipBar.scrollTo({left: c.offsetLeft - 24, behavior: RM ? 'auto' : 'smooth'});
    });
  });
}, {rootMargin: '-45% 0px -50% 0px'});
document.querySelectorAll('.prod').forEach(s => spy.observe(s));

// fixed nav (72px) + sticky category bar
const offset = () => -(72 + document.querySelector('.chips').offsetHeight);
let lenis = null;
const jump = t => {
  const top = t.getBoundingClientRect().top + scrollY + offset();
  if (lenis) lenis.scrollTo(top, {duration: 1.4});
  else scrollTo({top, behavior: RM ? 'auto' : 'smooth'});
};
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.querySelector(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  jump(t);
  history.replaceState(null, '', a.getAttribute('href'));
}));

function split(el) {
  const words = [];
  [...el.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(p => {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.append(' '); return; }
        const outer = document.createElement('span'), inner = document.createElement('span');
        outer.className = 'sw'; inner.className = 'swi'; inner.textContent = p;
        outer.append(inner); frag.append(outer); words.push(inner);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && n.tagName !== 'BR') {
      words.push(...split(n));
    }
  });
  return words;
}

if (window.gsap && window.ScrollTrigger && !RM) {
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis) {
    lenis = new Lenis({duration: 1.2, smoothWheel: true});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // page header
  gsap.timeline({defaults: {ease: 'power4.out'}})
    .from(split(document.querySelector('.ph-h1')), {yPercent: 115, duration: 1.3, stagger: .06}, .1)
    .from(['.ph .hero-eye', '.ph-desc'], {opacity: 0, y: 20, duration: 1, stagger: .15}, .4)
    .from('.chip', {opacity: 0, y: 12, duration: .8, stagger: .05}, .6)
    .from('.ph .hero-model-in', {y: 70, opacity: 0, duration: 1.6, ease: 'expo.out'}, .3);
  // spin the 3D soap in as soon as it is ready
  window.devSoap ? window.devSoap.spin() : (window.__soapSpin = true);

  // product rows: heading words rise, outline number slides in, photo wipes up with inner parallax
  document.querySelectorAll('.prod').forEach(row => {
    const h = row.querySelector('.heading');
    gsap.from(split(h), {yPercent: 115, duration: 1.1, stagger: .05, ease: 'power4.out',
      scrollTrigger: {trigger: h, start: 'top 88%'}});
    gsap.from(row.querySelector('.prod-num'), {xPercent: -30, opacity: 0, duration: 1.4, ease: 'expo.out',
      scrollTrigger: {trigger: row, start: 'top 75%'}});
    const media = row.querySelector('.prod-media');
    gsap.fromTo(media, {clipPath: 'inset(100% 0% 0% 0%)'}, {clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.out', clearProps: 'clipPath',
      scrollTrigger: {trigger: media, start: 'top 85%'}});
    const img = media.querySelector('img');
    if (img) {
      gsap.fromTo(img, {scale: 1.25}, {scale: 1.1, duration: 1.8, ease: 'expo.out', scrollTrigger: {trigger: media, start: 'top 85%'}});
      gsap.fromTo(img, {yPercent: -5}, {yPercent: 5, ease: 'none',
        scrollTrigger: {trigger: media, start: 'top bottom', end: 'bottom top', scrub: true}});
    }
  });

  document.querySelectorAll('#contact .heading').forEach(h => {
    h.classList.remove('rv');
    gsap.from(split(h), {yPercent: 115, duration: 1.1, stagger: .05, ease: 'power4.out',
      scrollTrigger: {trigger: h, start: 'top 88%'}});
  });

  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
}
