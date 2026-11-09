(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const $ = id => document.getElementById(id);
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- theme ---------- */
  const lightMQ = matchMedia('(prefers-color-scheme: light)');
  const themeBtn = $('themeBtn');
  const eff = () => root.dataset.theme || (lightMQ.matches ? 'light' : 'dark');
  const saved = store.get('ml-theme'); if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const syncTheme = () => {
    const t = eff(); themeBtn.dataset.mode = t;
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
  };
  syncTheme();
  lightMQ.addEventListener?.('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  themeBtn.addEventListener('click', () => {
    const next = eff() === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; store.set('ml-theme', next); };
    if (document.startViewTransition && !reduce) {
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      try {
        const vt = document.startViewTransition(apply);
        vt.ready.then(() => root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 700, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
        )).catch(() => {});
      } catch (e) { apply(); }
    } else apply();
  });

  /* ---------- glass highlight ---------- */
  const glasses = [...document.querySelectorAll('.glass')];
  let gRaf = 0, gx = 0, gy = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    gx = e.clientX; gy = e.clientY;
    if (gRaf) return;
    gRaf = requestAnimationFrame(() => {
      gRaf = 0;
      for (const g of glasses) {
        const r = g.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        g.style.setProperty('--mx', (gx - r.left) + 'px');
        g.style.setProperty('--my', (gy - r.top) + 'px');
      }
    });
  }, { passive: true });

  /* ---------- toast ---------- */
  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast glass'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.hidden = false;
    toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2400);
  }

  /* ---------- booking ---------- */
  const book = $('booking');
  let opener = null;
  const openBook = e => { opener = e.currentTarget; book.hidden = false; book.style.animation = 'none'; void book.offsetWidth; book.style.animation = ''; $('bookClose').focus(); };
  const closeBook = () => { if (book.hidden) return; book.hidden = true; opener?.focus(); };
  document.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', openBook));
  $('bookClose').addEventListener('click', closeBook);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeBook(); });
  addEventListener('pointerdown', e => { if (!book.hidden && !book.contains(e.target) && !e.target.closest('[data-book]')) closeBook(); });
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => {
    const out = btn.parentElement.querySelector('output');
    const fallback = () => { const s = getSelection(), r = document.createRange(); r.selectNodeContents(out); s.removeAllRanges(); s.addRange(r); toast('Номер выделен, скопируйте его'); };
    try { navigator.clipboard.writeText('+79244304551').then(() => toast('Номер скопирован'), fallback); } catch (e) { fallback(); }
  }));

  /* ---------- discount state ---------- */
  let hasDiscount = false; /* earned only by washing the car during this visit */
  function syncDiscount() {
    $('bkCode').hidden = !hasDiscount;
    $('discRow').hidden = !hasDiscount;
    $('tip').hidden = hasDiscount;
    $('offerState').textContent = hasDiscount ? 'Получена: кодовое слово MIRROR LAB' : 'Скидка ещё не получена';
    renderTotal();
  }

  /* ---------- count up ---------- */
  if (!reduce) document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now() + 900, dur = 1400;
    el.textContent = '0';
    const step = now => {
      const t = Math.max(0, Math.min(1, (now - t0) / dur));
      el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  /* ---------- calculator ---------- */
  const SERVICES = window.ML_PRICES;
  const TIME = { car: '4-6,5 ч', suv: '5-9 ч' };
  const NOTE = { car: 'Седан, хэтчбек, кроссовер, универсал', suv: 'Минивэн, джип, пикап' };
  let body = 'car';
  const sel = new Set();
  for (const s of SERVICES) {
    const lab = document.createElement('label');
    lab.className = 'item';
    lab.innerHTML = `<input type="checkbox" id="svc-${s.id}" value="${s.id}"${sel.has(s.id) ? ' checked' : ''}>` +
      `<span class="box" aria-hidden="true"><svg viewBox="0 0 16 16"><use href="#check"/></svg><i></i></span>` +
      `<span class="nm">${s.name}${s.note ? `<small>${s.note}</small>` : ''}</span>` +
      `<span class="pr">${s.from ? '<em>от</em>' : ''}<span class="v" data-id="${s.id}">${fmt(s[body])}</span> ₽</span>`;
    $(s.g === 'ext' ? 'g-ext' : 'g-int').appendChild(lab);
    lab.querySelector('input').addEventListener('change', e => { e.target.checked ? sel.add(s.id) : sel.delete(s.id); syncAll(); renderTotal(); });
  }
  const GROUPS = { ext: 'Весь кузов', int: 'Весь салон' };
  const groupSum = g => SERVICES.filter(s => s.g === g).reduce((a, s) => a + s[body], 0);
  const allBoxes = {};
  for (const g of ['ext', 'int']) {
    const lab = document.createElement('label');
    lab.className = 'item all';
    lab.innerHTML = `<input type="checkbox" id="all-${g}">` +
      `<span class="box" aria-hidden="true"><svg viewBox="0 0 16 16"><use href="#check"/></svg><i></i></span>` +
      `<span class="nm">${GROUPS[g]}<small>все услуги раздела</small></span>` +
      `<span class="pr">${g === 'ext' ? '<em>от</em>' : ''}<span class="v" data-all="${g}">${fmt(groupSum(g))}</span> ₽</span>`;
    const box = $(g === 'ext' ? 'g-ext' : 'g-int');
    box.insertBefore(lab, box.firstChild);
    const inp = lab.querySelector('input');
    allBoxes[g] = inp;
    inp.addEventListener('change', () => {
      for (const s of SERVICES) if (s.g === g) {
        const c = $('svc-' + s.id); c.checked = inp.checked;
        inp.checked ? sel.add(s.id) : sel.delete(s.id);
      }
      syncAll(); renderTotal();
    });
  }
  function syncAll() {
    for (const g of ['ext', 'int']) {
      const ids = SERVICES.filter(s => s.g === g).map(s => s.id);
      const n = ids.filter(id => sel.has(id)).length;
      allBoxes[g].checked = n === ids.length;
      allBoxes[g].indeterminate = n > 0 && n < ids.length;
    }
  }
  let shown = 0, tRaf = 0;
  function animateTo(el, to) {
    cancelAnimationFrame(tRaf);
    const from = shown, t0 = performance.now(), dur = reduce ? 0 : 500;
    const step = now => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      shown = from + (to - from) * (1 - Math.pow(1 - t, 3));
      el.textContent = fmt(shown);
      if (t < 1) tRaf = requestAnimationFrame(step);
    };
    tRaf = requestAnimationFrame(step);
  }
  function renderTotal() {
    let sum = 0, anyInt = false, from = false;
    for (const s of SERVICES) if (sel.has(s.id)) { sum += s[body]; if (s.g === 'int') anyInt = true; if (s.from) from = true; }
    const final = hasDiscount ? sum * .9 : sum;
    animateTo($('total'), final);
    $('old').textContent = hasDiscount && sum ? fmt(sum) + ' ₽' : '';
    $('from').hidden = !from;
    $('count').textContent = sel.size;
    $('sumLbl').textContent = sel.size ? 'Итого' : 'Выберите услуги';
    $('time').textContent = anyInt ? TIME[body] : 'не выбрано';
  }
  const seg = $('seg');
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (body === b.dataset.body) return;
    body = b.dataset.body; seg.dataset.body = body;
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('segNote').textContent = NOTE[body];
    document.querySelectorAll('.pr .v').forEach((v, i) => {
      const s = v.dataset.all ? null : SERVICES.find(x => x.id === v.dataset.id);
      v.classList.remove('flip'); void v.offsetWidth;
      if (!reduce) { v.style.animationDelay = (i * 25) + 'ms'; v.classList.add('flip'); }
      setTimeout(() => { v.textContent = fmt(s ? s[body] : groupSum(v.dataset.all)); }, reduce ? 0 : 200 + i * 25);
    });
    renderTotal();
  }));

  /* ---------- before / after: one gentle sweep the first time a real photo pair comes into view ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const ba = e.target, inp = ba.querySelector('input');
      const keys = [50, 22, 78, 50], t0 = performance.now() + 300, dur = 2200;
      const touched0 = () => ba.dataset.touched === '1';
      const step = now => {
        if (touched0()) return;
        const t = Math.max(0, Math.min(1, (now - t0) / dur)), seg = Math.min(2, Math.floor(t * 3)), lt = t * 3 - seg;
        const k = lt < .5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
        const v = keys[seg] + (keys[seg + 1] - keys[seg]) * k;
        setBA(ba, v);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: .6 });
    document.querySelectorAll('.ba.has-photo').forEach(b => io.observe(b));
  }

  /* ---------- before / after sliders: drag anywhere on the card (mouse or finger), arrows on keyboard ---------- */
  function setBA(ba, v) {
    v = Math.max(0, Math.min(100, v));
    ba.style.setProperty('--pos', v + '%');
    const inp = ba.querySelector('input'); if (inp) inp.value = v;
    const l = ba.querySelector('.tag.l'), r = ba.querySelector('.tag.r');
    if (l) l.style.opacity = v < 18 ? 0 : 1;
    if (r) r.style.opacity = v > 82 ? 0 : 1;
  }
  document.querySelectorAll('.ba').forEach(ba => {
    const inp = ba.querySelector('input');
    const fromEvent = e => { const r = ba.getBoundingClientRect(); setBA(ba, (e.clientX - r.left) / r.width * 100); };
    let drag = false, startX = 0, startY = 0, decided = false;
    ba.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      ba.dataset.touched = '1';
      drag = true; decided = e.pointerType === 'mouse'; startX = e.clientX; startY = e.clientY;
      if (decided) { ba.classList.add('dragging'); fromEvent(e); }
      try { ba.setPointerCapture(e.pointerId); } catch (_) {}
    });
    ba.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!decided) {
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { drag = false; return; }
        decided = true; ba.classList.add('dragging');
      }
      fromEvent(e);
    });
    const stop = e => {
      if (drag && !decided && e && e.type === 'pointerup') fromEvent(e); /* a tap moves the divider there */
      drag = false; ba.classList.remove('dragging');
    };
    ba.addEventListener('pointerup', stop);
    ba.addEventListener('pointercancel', () => { drag = false; ba.classList.remove('dragging'); });
    if (inp) inp.addEventListener('input', () => { ba.dataset.touched = '1'; setBA(ba, +inp.value); });
    setBA(ba, inp ? +inp.value : 50);
  });

  /* ---------- wireframe mesh ---------- */
  const mesh = $('mesh'), mx = mesh.getContext('2d');
  let mW = 0, mH = 0, meshOn = true;
  function sizeMesh() {
    const r = mesh.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    mW = r.width; mH = r.height; mesh.width = Math.round(mW * dpr); mesh.height = Math.round(mH * dpr);
    mx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawMesh(t) {
    mx.clearRect(0, 0, mW, mH);
    mx.strokeStyle = getComputedStyle(root).getPropertyValue('--mesh').trim() || 'rgba(255,255,255,.13)';
    mx.lineWidth = .7;
    const rows = 26, cols = 70, pts = [];
    for (let j = 0; j < rows; j++) {
      const row = [], v = j / (rows - 1);
      for (let i = 0; i < cols; i++) {
        const u = i / (cols - 1), env = Math.sin(Math.PI * u);
        const y = mH * (.2 + .65 * v) + env * (Math.sin(u * 5.2 + t * .00055 + v * 2.4) * 34 + Math.cos(u * 2.3 - t * .0004 + v * 4) * 22) * (1 - v * .35);
        row.push([u * mW, y]);
      }
      pts.push(row);
      mx.beginPath(); row.forEach(([x, y], i) => i ? mx.lineTo(x, y) : mx.moveTo(x, y)); mx.stroke();
    }
    for (let i = 0; i < cols; i += 5) {
      mx.beginPath();
      for (let j = 0; j < rows; j++) { const [x, y] = pts[j][i]; j ? mx.lineTo(x, y) : mx.moveTo(x, y); }
      mx.stroke();
    }
  }
  function loopMesh(t) { if (meshOn && !document.hidden) drawMesh(t); requestAnimationFrame(loopMesh); }
  sizeMesh(); drawMesh(0);
  if (!reduce) requestAnimationFrame(loopMesh);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { meshOn = es[0].isIntersecting; }).observe(mesh);

  /* ---------- car wash game ---------- */
  const stage = $('stage'), cv = $('dirt'), ctx = cv.getContext('2d');
  const clean = $('clean'), dirty = $('dirtyImg'), brush = $('brush');
  const bar = $('bar'), pctEl = $('pct'), hint = $('hint'), hud = $('hud'), coupon = $('coupon');
  const CIRC = 62.83, FINISH = 0.9; /* доля грязи, которую надо отмыть для скидки */
  const idle = coarse ? 'Отмойте машину пальцем и получите −10%' : 'Отмойте машину курсором и получите −10%';
  hint.textContent = idle;

  const MW = 787, MH = 352, R = MW * (coarse ? 0.046 : 0.042); /* размер кисти: меньше = сложнее */
  const mask = document.createElement('canvas'); mask.width = MW; mask.height = MH;
  const mctx = mask.getContext('2d');
  let W = 0, H = 0, ready = false, done = false, demoRunning = false, userTouched = false, last = null;

  function resize() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H; render(); if (carRaw) padMap(); sizeMesh();
  }
  function render() {
    if (!ready) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(dirty, 0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  let rRaf = 0;
  const schedule = () => { if (!rRaf) rRaf = requestAnimationFrame(() => { rRaf = 0; render(); }); };
  function dab(x, y) {
    const g = mctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.5, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g; mctx.beginPath(); mctx.arc(x, y, R, 0, Math.PI * 2); mctx.fill();
  }
  function strokeTo(fx, fy) {
    const x = fx * MW, y = fy * MH;
    if (last) {
      const dx = x - last.x, dy = y - last.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (R * .22)));
      for (let i = 1; i <= n; i++) dab(last.x + dx * i / n, last.y + dy * i / n);
    } else dab(x, y);
    last = { x, y }; schedule(); queueMeasure();
  }

  /* low-res maps: car silhouette (where the brush may work) and dirt weight (what counts for progress) */
  const PW = 160, PH = 72;
  const pc = document.createElement('canvas'); pc.width = PW; pc.height = PH;
  const pctx = pc.getContext('2d', { willReadFrequently: true });
  let weights = null, totalW = 1, carMap = null, carRaw = null;
  function buildMaps() {
    try {
      pctx.drawImage(clean, 0, 0, PW, PH); const a = pctx.getImageData(0, 0, PW, PH).data;
      pctx.clearRect(0, 0, PW, PH);
      pctx.drawImage(dirty, 0, 0, PW, PH); const b = pctx.getImageData(0, 0, PW, PH).data;
      weights = new Uint8Array(PW * PH); carRaw = new Uint8Array(PW * PH); totalW = 0;
      for (let i = 0; i < PW * PH; i++) {
        const k = i * 4;
        if (a[k + 3] > 110) carRaw[i] = 1;
        if (a[k + 3] > 140 && Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2])) > 18) { weights[i] = 1; totalW++; }
      }
      if (totalW < 200) { weights.fill(1); totalW = PW * PH; }
    } catch (e) { weights = null; carRaw = null; }
    padMap();
  }
  /* widen the allowed zone around the car silhouette: ~10px with a mouse, ~18px for a finger */
  function padMap() {
    if (!carRaw) { carMap = null; return; }
    const w = stage.getBoundingClientRect().width || 800;
    const d = Math.max(1, Math.ceil((coarse ? 18 : 10) / (w / PW)));
    carMap = new Uint8Array(PW * PH);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      if (!carRaw[y * PW + x]) continue;
      for (let dy = -d; dy <= d; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= PH) continue;
        for (let dx = -d; dx <= d; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= PW || dx * dx + dy * dy > d * d) continue;
          carMap[yy * PW + xx] = 1;
        }
      }
    }
  }
  function onCar(fx, fy) {
    if (!carMap) return fx > .05 && fx < .95 && fy > .15 && fy < .95;
    const x = Math.floor(fx * PW), y = Math.floor(fy * PH);
    if (x < 0 || y < 0 || x >= PW || y >= PH) return false;
    return carMap[y * PW + x] === 1;
  }
  let mT = 0;
  const queueMeasure = () => { if (!mT) mT = setTimeout(() => { mT = 0; measure(); }, 160); };
  function measure() {
    if (!weights || done) return;
    pctx.clearRect(0, 0, PW, PH); pctx.drawImage(mask, 0, 0, PW, PH);
    const m = pctx.getImageData(0, 0, PW, PH).data;
    let s = 0;
    for (let i = 0; i < PW * PH; i++) if (weights[i]) s += m[i * 4 + 3];
    const p = Math.min(1, s / 255 / totalW / FINISH);
    setProgress(p);
    if (p >= 1 && !demoRunning) finish();
  }
  function setProgress(p) {
    pctEl.textContent = Math.round(p * 100) + '%';
    bar.style.strokeDashoffset = (CIRC * (1 - p)).toFixed(2);
  }
  function finish() {
    if (done) return;
    done = true; setProgress(1);
    stage.classList.add('done'); stage.classList.remove('oncar');
    hud.hidden = true; coupon.hidden = false;
    hasDiscount = true; syncDiscount();
  }
  $('againBtn').addEventListener('click', () => {
    done = false; last = null; userTouched = true;
    mctx.clearRect(0, 0, MW, MH); render();
    stage.classList.remove('done');
    coupon.hidden = true; hud.hidden = false; hint.textContent = 'Скидка уже ваша, можно отмыть ещё раз';
    setProgress(0);
  });

  function local(e) {
    const r = stage.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, px: e.clientX - r.left, py: e.clientY - r.top, w: r.width };
  }
  function placeBrush(x, y, w) {
    const s = R / MW * w * 1.7;
    brush.style.width = brush.style.height = s + 'px';
    brush.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px)`;
  }
  function move(e) {
    if (done || demoRunning) return;
    const p = local(e);
    const inside = onCar(p.fx, p.fy);
    stage.classList.toggle('oncar', inside);
    if (!inside) { last = null; return; }
    placeBrush(p.px, p.py, p.w);
    if (e.pointerType === 'mouse' || e.buttons || e.type === 'pointerdown') {
      userTouched = true;
      if (ready) strokeTo(Math.min(1, Math.max(0, p.fx)), Math.min(1, Math.max(0, p.fy)));
    }
  }
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { try { stage.setPointerCapture(e.pointerId); } catch (_) {} } last = null; move(e); });
  const lift = () => { last = null; if (!matchMedia('(pointer:fine)').matches) stage.classList.remove('oncar'); };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  stage.addEventListener('pointerleave', () => { last = null; stage.classList.remove('oncar'); });

  function demo() {
    if (reduce || userTouched || done) return;
    demoRunning = true; stage.classList.add('demo'); last = null;
    const t0 = performance.now(), dur = 1800;
    const end = () => {
      demoRunning = false; last = null; stage.classList.remove('demo');
      if (userTouched) { measure(); return; }
      /* the demo stripe is only a hint: let the dirt come back so it does not count toward the discount */
      setTimeout(() => {
        let n = 0;
        const fade = () => {
          if (userTouched || done) { measure(); return; }
          mctx.globalCompositeOperation = 'destination-out';
          mctx.fillStyle = 'rgba(0,0,0,.14)'; mctx.fillRect(0, 0, MW, MH);
          mctx.globalCompositeOperation = 'source-over';
          render();
          if (++n < 28) requestAnimationFrame(fade); else { mctx.clearRect(0, 0, MW, MH); render(); setProgress(0); }
        };
        requestAnimationFrame(fade);
      }, 700);
    };
    const step = now => {
      if (userTouched) return end();
      const t = Math.min(1, (now - t0) / dur);
      const k = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const fx = .14 + .74 * k, fy = .58 - .1 * Math.sin(k * Math.PI);
      if (onCar(fx, fy)) strokeTo(fx, fy); else last = null;
      const r = stage.getBoundingClientRect(); placeBrush(fx * r.width, fy * r.height, r.width);
      t < 1 ? requestAnimationFrame(step) : end();
    };
    requestAnimationFrame(step);
  }

  const decode = img => (img.decode ? img.decode() : new Promise(r => img.complete ? r() : img.addEventListener('load', r, { once: true }))).catch(() => {});
  Promise.all([decode(clean), decode(dirty)]).then(() => {
    ready = true; buildMaps(); resize();
    stage.classList.add('ready');
    setTimeout(demo, reduce ? 0 : 2800);
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => resize()).observe(stage);
  else addEventListener('resize', resize);

  syncDiscount();
})();
