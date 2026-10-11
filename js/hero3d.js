/* ═══════════════════════════════════════════════════════════════════════
   ВЕРНИСАЖ — живая скульптура первого экрана.

   Под холстом всегда лежит картинка-кадр (img/sculpt/hero.webp — тот же
   вид в момент t=0), поэтому без WebGL, в режиме «уменьшить движение»
   и на паузе страница выглядит так же, только без переливания.

   Пауза (WCAG 2.2.2): кнопка «Остановить анимацию» в первом экране,
   выбор помним в localStorage. При «уменьшить движение» стартуем на паузе
   и WebGL не поднимаем, пока человек сам не включит анимацию.
   Холст останавливается, когда ушёл с экрана или вкладка скрыта; на
   слабом устройстве (кадр дольше ~45 мс) возвращаемся к картинке.
   ═══════════════════════════════════════════════════════════════════════ */
const art = document.getElementById('hero-art');
const canvas = document.getElementById('hero-canvas');
const btn = document.getElementById('motion');
const KEY = 'vernissage:motion';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const forced = matchMedia('(forced-colors: active)');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

function webgl2() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}
function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ } }

const saveData = navigator.connection && navigator.connection.saveData;
if (art && canvas && btn && webgl2() && !forced.matches && !saveData) boot();

function boot() {
  let s = null, loading = null, raf = 0, last = 0, t = 0, onScreen = true;
  let running = false;
  let px = 0, py = 0, tx = 0, ty = 0, scrollTilt = 0, scrollTiltT = 0, scrollSpin = 0, scrollSpinT = 0;
  /* появление — один раз за загрузку страницы; считаем по времени кадров,
     а не по часам: после паузы оно не «перескакивает» */
  let introK = 0;
  /* «уменьшить движение»: даже если анимацию включили кнопкой, остаётся
     только медленное переливание — без появления, наклона и поворота */
  const calm = () => reduce.matches;
  const frames = [];
  let wantOn = saved() ? saved() === 'on' : !reduce.matches;

  btn.hidden = false;
  label();
  /* анимация включена — кадр-картинку не показываем, первым кадром будет
     «вливание» скульптуры; если WebGL так и не заработал, картинка вернётся */
  if (wantOn) {
    art.classList.add('is-boot');
    setTimeout(() => { if (!art.classList.contains('is-live')) art.classList.remove('is-boot'); }, 2500);
  }

  function label() {
    btn.querySelector('.motion__t').textContent = wantOn ? 'Остановить анимацию' : 'Запустить анимацию';
    btn.querySelector('use').setAttribute('href', wantOn ? '#i-pause' : '#i-play');
  }

  async function ensure() {
    if (s) return s;
    if (!loading) {
      /* та же метка версии ?v=, что у самого модуля: reg.ru держит .js в кеше 45 суток */
      loading = import('./sculpture.js' + new URL(import.meta.url).search).then(({ createSculpture }) => {
        const dpr = Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.5);
        /* ?sculptdebug&vo={...} — подобрать ракурс прямо на странице (tools/) */
        let viewOverride = {};
        if (/[?&]sculptdebug/.test(location.search)) { try { viewOverride = JSON.parse(new URLSearchParams(location.search).get('vo') || '{}'); } catch (e) { /* без ракурса */ } }
        s = createSculpture(canvas, { view: 'hero', detail: fine ? 128 : 72, dpr, viewOverride });
        resize();
        return s;
      }).catch(() => { stopLive(true); return null; });   /* модуль не загрузился — честно прячем кнопку */
    }
    return loading;
  }

  function resize() {
    if (!s) return;
    const r = art.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) s.setSize(Math.round(r.width), Math.round(r.height));
    if (!running) draw();
  }

  function draw() {
    /* холст отражён по X — знак наклона от мыши тоже отражаем */
    s.setParallax(-px, py + scrollTilt);
    /* медленное покачивание + доворот при прокрутке; диапазон поворота
       проверен tools/overlap.mjs: скульптура не заходит под текст */
    /* качание −0,2…+0,4 рад + доворот прокруткой; что форма не заходит под
       остальной текст первого экрана, проверяет tools/overlap.mjs */
    s.setSpin(0.1 + Math.sin(t * 0.1) * 0.3 + scrollSpin);
    s.render(t);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    t += dt;
    if (calm()) { tx = ty = scrollTiltT = scrollSpinT = 0; introK = 1; }
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    /* прокрутка рывком (Page Down, Home, ползунок) не должна резко
       поворачивать большую блестящую форму: не быстрее 0,5 рад/с */
    const lim = 0.5 * dt;
    scrollSpin += Math.max(-lim, Math.min(lim, (scrollSpinT - scrollSpin) * 0.08));
    scrollTilt += Math.max(-lim, Math.min(lim, (scrollTiltT - scrollTilt) * 0.08));
    introK = Math.min(1, introK + dt / 1.8);
    s.setIntro(introK);
    draw();
    if (frames.length < 120) {
      frames.push(dt * 1000);
      if (frames.length === 120) guard();
    }
    if (!art.classList.contains('is-live')) art.classList.add('is-live');
  }

  /* слабое устройство: медленные кадры → меньше пикселей → картинка */
  let downgraded = false;
  function guard() {
    const sorted = frames.slice(20).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] || 0;
    if (med > 45 && downgraded) { stopLive(true); }
    else if (med > 34 && !downgraded) {
      downgraded = true; frames.length = 0;
      s.renderer.setPixelRatio(1); resize();
    }
  }
  function stopLive(forever) {
    pause();
    introK = 1; if (s) s.setIntro(1);
    art.classList.remove('is-live', 'is-boot');
    if (forever) {
      /* кнопку прячем, а фокус с неё не должен упасть на body */
      if (document.activeElement === btn) {
        const h = document.getElementById('hero-h');
        h.tabIndex = -1; h.focus();
        h.addEventListener('blur', () => h.removeAttribute('tabindex'), { once: true });
      }
      btn.hidden = true; if (s) s.dispose(); s = null;
    }
  }

  async function play() {
    if (running || !onScreen || document.hidden) return;
    await ensure();
    if (!s || running || !wantOn) return;
    running = true; last = 0;
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf); raf = 0;
  }

  btn.addEventListener('click', async () => {
    wantOn = !wantOn;
    save(wantOn ? 'on' : 'off');
    label();
    if (wantOn) play();
    else {
      pause();
      /* стоп-кадр: холст остаётся на текущей позе, без параллакса */
      introK = 1;
      if (s) { tx = ty = px = py = scrollTilt = scrollTiltT = scrollSpin = scrollSpinT = 0; s.setIntro(1); draw(); }
    }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      onScreen = en.some((x) => x.isIntersecting);
      if (onScreen && wantOn) play(); else pause();
    }, { threshold: 0 }).observe(art);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (wantOn) play(); });
  reduce.addEventListener && reduce.addEventListener('change', () => { if (reduce.matches && !saved()) { wantOn = false; label(); pause(); } });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(art);

  /* лёгкий параллакс ±3° от мыши и прокрутки — только пока анимация идёт */
  if (fine) {
    window.addEventListener('pointermove', (e) => {
      if (!running || calm()) return;
      /* наклон за курсором до ±8° */
      tx = ((e.clientX / innerWidth) - 0.5) * 0.28;
      ty = ((e.clientY / innerHeight) - 0.5) * 0.28;
    }, { passive: true });
  }
  window.addEventListener('scroll', () => {
    if (!running || calm()) return;
    const r = art.getBoundingClientRect();
    const k = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
    scrollTiltT = k * 0.052;
    /* уходит вверх при прокрутке — доворачивается до 0,35 рад */
    scrollSpinT = Math.max(0, Math.min(1, -r.top / r.height)) * 0.35;
  }, { passive: true });

  if (wantOn) play();

  /* для tools/overlap.mjs: поставить любую позу и проверить, что
     скульптура не заходит под текст. Только с ?sculptdebug в адресе. */
  if (/[?&]sculptdebug/.test(location.search)) {
    window.__sculpt = {
      async pose(tt, spin, ppx, ppy, intro = 1) {
        wantOn = false; pause(); await ensure();
        s.setIntro(intro); s.setSpin(spin); s.setParallax(-ppx, ppy); s.render(tt);
        art.classList.add('is-live');
        return true;
      }
    };
  }
}
