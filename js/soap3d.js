// Live 3D Rose Soap for the hero. The pre-rendered soap-model.webp stays in the page as the
// fallback (no WebGL, reduced motion, script blocked) and is cross-faded out once this is ready.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './three-addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './three-addons/RoomEnvironment.js';

const host = document.querySelector('.hero-model-in');
const hero = host && host.closest('#hero, .ph');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (host && hero && !reduced) init().catch(() => {});

async function init() {
  const canvas = document.createElement('canvas');
  canvas.className = 'soap-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL: keep the still image
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .82;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

  // same bar, materials and lights as the pre-rendered image, so the swap is seamless
  const BW = 9, BD = 6.1, BH = 2.4;
  const body = bodyTexture();
  const soap = new THREE.Mesh(
    new RoundedBoxGeometry(BW, BH, BD, 8, .55),
    new THREE.MeshPhysicalMaterial({
      map: body, roughness: .22, metalness: 0, clearcoat: 1, clearcoatRoughness: .08,
      emissive: new THREE.Color('#ff8a2a'), emissiveMap: body, emissiveIntensity: .22, ior: 1.45, specularIntensity: .8
    })
  );
  const labelTex = await new THREE.TextureLoader().loadAsync('soap-label.webp');
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const LW = 7.1, LH = LW * 600 / 873;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: .7, metalness: 0, envMapIntensity: .25 }));
  label.rotation.x = -Math.PI / 2;
  label.position.y = BH / 2 + .006;

  const bar = new THREE.Group();
  bar.add(soap, label);
  scene.add(bar);

  const key = new THREE.DirectionalLight(0xfff1e0, 2.4); key.position.set(-8, 16, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc48a, 3); rim.position.set(10, 6, -10); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a2a1a, .5));

  const cam = new THREE.PerspectiveCamera(24, 1, .1, 200);
  const elev = THREE.MathUtils.degToRad(42);
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    // keep the bar ~72% of the canvas width at its resting angle, as in the still image
    const dist = 5.217 / (.72 * Math.tan(THREE.MathUtils.degToRad(12)) * cam.aspect);
    cam.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  };

  host.appendChild(canvas);
  fit();
  new ResizeObserver(fit).observe(canvas);

  /* ── motion: the bar never spins round — it sways, leans toward the pointer,
        tilts with scroll and springs back to face the front after a drag ── */
  const D = THREE.MathUtils.degToRad;
  bar.rotation.order = 'YXZ';
  const REST = D(-16);
  const st = {y: REST, vy: 0, x: 0, vx: 0};
  const pointer = {x: 0, y: 0};
  let drag = null, dragY = 0, dragX = 0, introStart = -1;

  window.devSoap = {
    // reveal: the bar turns in from the side and settles facing front
    spin() {
      introStart = performance.now();
      st.y = REST - D(80); st.x = D(22); st.vy = st.vx = 0;
      // the soap starts side-on, so drop the still image at once instead of cross-fading
      host.classList.add('no-fade');
      if (shown) host.classList.add('is-3d');
    }
  };

  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      pointer.x = e.clientX / innerWidth * 2 - 1;
      pointer.y = e.clientY / innerHeight * 2 - 1;
    }, {passive: true});
  }

  canvas.addEventListener('pointerdown', e => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    dragY = THREE.MathUtils.clamp(dragY + (e.clientX - drag.x) * .01, -D(85), D(85));
    dragX = THREE.MathUtils.clamp(dragX + (e.clientY - drag.y) * .006, -D(25), D(25));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const release = () => {
    if (!drag) return;
    drag = null; dragY = 0; dragX = 0;   // the spring carries it back with a soft settle
    canvas.classList.remove('grabbing');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // slightly under-damped spring: smooth follow with a gentle settle
  const spring = (pos, vel, target, k, dt) => {
    const c = 2 * Math.sqrt(k) * .72;
    for (let i = 0; i < 2; i++) {
      vel += (k * (target - pos) - c * vel) * dt / 2;
      pos += vel * dt / 2;
    }
    return [pos, vel];
  };

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }).observe(hero);

  let last = performance.now(), running = false, shown = false;
  function frame(now) {
    if (shown && !host.classList.contains('is-3d')) host.classList.add('is-3d');
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const t = now / 1000;
    const scroll = Math.min(Math.max(scrollY / hero.offsetHeight, 0), 1);

    let introY = 0, introX = 0;
    if (introStart >= 0) {
      const p = Math.min((now - introStart) / 2400, 1), left = Math.pow(1 - p, 4);
      introY = -D(80) * left; introX = D(22) * left;
      if (p >= 1) introStart = -1;
    }

    const targetY = REST + D(9) * Math.sin(t * .55) + pointer.x * D(18) + scroll * D(55) + dragY + introY;
    const targetX = D(3) * Math.sin(t * .8 + 1) + pointer.y * D(7) + scroll * D(16) + dragX + introX;
    const k = drag ? 220 : introStart >= 0 ? 160 : 36;
    [st.y, st.vy] = spring(st.y, st.vy, targetY, k, dt);
    [st.x, st.vx] = spring(st.x, st.vx, targetX, k, dt);

    if (!shown) {
      shown = true;
      // reveal asked for just now: swap straight to 3D (no cross-fade, so no double image)
      if (window.__soapSpin && now - window.__soapSpin < 900) {
        host.classList.add('no-fade');
        window.devSoap.spin();
        return frame(now);
      }
      host.classList.add('is-3d');
    }
    bar.rotation.y = st.y;
    bar.rotation.x = st.x;
    bar.position.y = .16 * Math.sin(t * .9);   // soft float
    renderer.render(scene, cam);
  }
  function loop() {
    if (running) return;
    running = true; last = performance.now();
    const tick = now => {
      if (!visible) { running = false; return; }
      frame(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  loop();
}

// amber glycerin with soft internal swirls
function bodyTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 1024);
  grd.addColorStop(0, '#cf6f28'); grd.addColorStop(.5, '#c05f1c'); grd.addColorStop(1, '#d27a33');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, r = 10 + rnd() * 60;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > .5;
    rg.addColorStop(0, light ? 'rgba(255,196,120,.07)' : 'rgba(150,60,10,.06)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,220,170,.035)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    g.beginPath(); let x = rnd() * 1024, y = rnd() * 1024; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 160; y += (rnd() - .5) * 160; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
