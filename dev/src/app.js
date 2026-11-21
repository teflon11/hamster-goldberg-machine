/* ------------------------------------------------------------------ *
 * Витрина: отрисовка, интерфейс, звук. Физика — вся в createMachine. *
 * ------------------------------------------------------------------ */
(function () {
  var W = 1600, H = 900, STEP = 1000 / 60;

  var canvas = document.getElementById('view');
  var ctx = canvas.getContext('2d');
  var elList = document.getElementById('stageList');
  var elStatus = document.getElementById('status');
  var elProg = document.getElementById('prog');
  var elStart = document.getElementById('start');
  var elReset = document.getElementById('reset');
  var elWin = document.getElementById('win');
  var elBar = document.getElementById('bar');
  var elScene = document.getElementById('scene');

  var machine = null, running = false, acc = 0, last = 0;
  var seenLog = 0, bellFlash = 0, confetti = null, won = false;

  /* ---------- нижняя панель: резервируем её высоту явно ---------- */
  function reserveBar() {
    document.documentElement.style.setProperty('--bar', elBar.offsetHeight + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(reserveBar).observe(elBar);
  window.addEventListener('resize', reserveBar);
  reserveBar();

  /* ---------- звук (WebAudio, без внешних файлов) ---------- */

  var ac = null;
  function audio() {
    if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, gain, when) {
    var a = audio(); if (!a) return;
    var t0 = a.currentTime + (when || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sClick() { tone(1150 + Math.random() * 260, 0.05, 'square', 0.045); }
  function sBell() {
    [1046, 1568, 2093, 2637].forEach(function (f, i) {
      tone(f, 1.5 - i * 0.22, 'sine', 0.2 - i * 0.037, i * 0.004);
    });
    tone(1570, 0.5, 'triangle', 0.05, 0.02);
  }
  function sWake() {
    tone(520, 0.1, 'triangle', 0.12, 0);
    tone(780, 0.12, 'triangle', 0.12, 0.09);
    tone(1040, 0.16, 'triangle', 0.1, 0.19);
  }
  function sWin() {
    [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.42, 'triangle', 0.15, i * 0.11); });
  }
  function sFail() { tone(220, 0.35, 'sawtooth', 0.1); tone(180, 0.4, 'sawtooth', 0.09, 0.12); }

  /* ---------- панель этапов ---------- */

  function buildList() {
    elList.innerHTML = '';
    machine.stages.forEach(function (s) {
      var li = document.createElement('li');
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = machine.stages.indexOf(s) + 1;
      li.querySelector('span').textContent = s.name;
      elList.appendChild(li);
    });
  }
  function sync() {
    var st = machine.state();
    var items = elList.children;
    for (var i = 0; i < items.length; i++) {
      items[i].className = st.flags[machine.stages[i].id] ? 'ok' : (i === st.stage && running ? 'now' : '');
    }
    elProg.textContent = st.doneCount + '/' + st.total;
    elStatus.className = '';
    if (st.done) { elStatus.textContent = 'Хомяк проснулся! Все ' + st.total + ' этапов сработали.'; elStatus.className = 'good'; }
    else if (st.failed) { elStatus.textContent = 'Стоп: ' + st.failed; elStatus.className = 'bad'; }
    else if (running) { elStatus.textContent = 'Идёт этап ' + (st.stage + 1) + ': ' + st.stageName; }
    else if (won) { elStatus.textContent = 'Машина поработала. «Сброс» — и сначала.'; elStatus.className = 'good'; }
    else { elStatus.textContent = 'Нажмите «Пуск» — и машина разбудит хомяка.'; }
    elStart.disabled = running || st.done;
    elWin.className = st.done ? 'on' : '';
  }

  /* ---------- сборка/сброс машины ---------- */

  function boot() {
    machine = createMachine(Matter);
    machine.settle();
    seenLog = 0; bellFlash = 0; confetti = null; won = false; running = false;
    acc = 0; last = 0;
    buildList(); sync(); draw();
  }

  function pumpLog() {
    while (seenLog < machine.log.length) {
      var e = machine.log[seenLog++];
      if (e.type === 'click') sClick();
      else if (e.type === 'bell') { sBell(); bellFlash = 1; }
      else if (e.type === 'wake') sWake();
      else if (e.type === 'win') { sWin(); confetti = makeConfetti(); won = true; }
      else if (e.type === 'stall' || e.type === 'nan') sFail();
    }
  }

  /* ---------- цикл: физика только фиксированным шагом ---------- */

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(ts - last, 120); last = ts;
    if (running) {
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 5) { machine.tick(); acc -= STEP; n++; }
      if (machine.state().done || machine.state().failed) running = false;
      pumpLog();
      sync();
    }
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- отрисовка ---------- */

  function pathBody(b) {
    ctx.beginPath();
    var v = b.vertices;
    ctx.moveTo(v[0].x, v[0].y);
    for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }
  function partsOf(body) {
    return body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  }
  function fill(body, fallback) {
    var r = body.render || {};
    ctx.fillStyle = r.fillStyle || fallback || '#8a94a6';
    ctx.strokeStyle = r.strokeStyle || 'rgba(0,0,0,.35)';
    ctx.lineWidth = r.lineWidth == null ? 2 : r.lineWidth;
  }

  var rngSeed = 20261120;
  function rnd() { rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff; return rngSeed / 0x7fffffff; }

  function makeConfetti() {
    rngSeed = 20261120;
    var cols = ['#ffd451', '#ff6b6b', '#5ad1a8', '#6ab7ff', '#ff9f43', '#e77fbe'];
    var list = [];
    for (var i = 0; i < 170; i++) {
      list.push({ x: rnd() * W, y: -rnd() * H, vx: (rnd() - .5) * 2.2, vy: 1.6 + rnd() * 3.4,
        a: rnd() * 6.28, va: (rnd() - .5) * .3, s: 5 + rnd() * 9, c: cols[(rnd() * cols.length) | 0] });
    }
    return { t: 0, list: list };
  }

  function drawHamster(b) {
    var st = machine.state(), awake = st.hamsterAwake, p = b.position, r = 26;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = awake ? '#e2ab63' : '#c99a5f';
    ctx.strokeStyle = '#8a5f2c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.12, r, 0, 0, 6.284); ctx.fill(); ctx.stroke();
    // ушки
    ctx.fillStyle = '#d8a15c';
    [[-r * .55, -r * .82], [r * .55, -r * .82]].forEach(function (e) {
      ctx.beginPath(); ctx.arc(e[0], e[1], r * .34, 0, 6.284); ctx.fill(); ctx.stroke();
    });
    // полоски
    ctx.strokeStyle = 'rgba(140,92,40,.5)'; ctx.lineWidth = 3;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 9 - 3, -r * .62); ctx.quadraticCurveTo(i * 9, 0, i * 9 - 3, r * .62); ctx.stroke();
    }
    // мордочка
    ctx.fillStyle = '#f3d7ae';
    ctx.beginPath(); ctx.ellipse(0, r * .3, r * .55, r * .42, 0, 0, 6.284); ctx.fill();
    ctx.fillStyle = '#3a2a17';
    if (awake) {
      [[-r * .34, -r * .12], [r * .34, -r * .12]].forEach(function (e) {
        ctx.beginPath(); ctx.arc(e[0], e[1], 3.6, 0, 6.284); ctx.fill();
      });
      ctx.strokeStyle = '#3a2a17'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, r * .22, 6, .2, Math.PI - .2); ctx.stroke();
    } else {
      ctx.strokeStyle = '#3a2a17'; ctx.lineWidth = 2.4;
      [[-r * .34, -r * .12], [r * .34, -r * .12]].forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(e[0] - 5, e[1]); ctx.lineTo(e[0] + 5, e[1]); ctx.stroke();
      });
    }
    ctx.fillStyle = '#e0808f';
    ctx.beginPath(); ctx.arc(0, r * .12, 3.4, 0, 6.284); ctx.fill();
    ctx.restore();
    if (!awake) {
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '600 22px "Segoe UI",sans-serif';
      ctx.fillText('z', p.x + r + 6, p.y - r - 10);
      ctx.font = '600 16px "Segoe UI",sans-serif';
      ctx.fillText('z', p.x + r + 20, p.y - r - 24);
    }
  }

  function drawBell(b) {
    var bnd = b.bounds, x = bnd.min.x, w = bnd.max.x - bnd.min.x, y = bnd.min.y, h = bnd.max.y - bnd.min.y;
    var glow = bellFlash > 0 ? bellFlash : 0;
    if (glow) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,225,120,' + (0.9 * glow) + ')';
      ctx.shadowBlur = 46 * glow;
      ctx.restore();
    }
    ctx.fillStyle = glow ? 'rgb(255,' + (200 + 55 * glow | 0) + ',' + (60 + 120 * glow | 0) + ')' : '#f0c419';
    ctx.strokeStyle = '#8a6a0c'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * .18, y + h * .92);
    ctx.quadraticCurveTo(x + w * .1, y + h * .3, x + w * .5, y + h * .06);
    ctx.quadraticCurveTo(x + w * .9, y + h * .3, x + w * .82, y + h * .92);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w * .5, y + h * .93, w * .36, h * .1, 0, 0, 6.284);
    ctx.fillStyle = '#d9ad12'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b9930f';
    ctx.beginPath(); ctx.arc(x + w * .5, y + h * 1.02, w * .1, 0, 6.284); ctx.fill();
    if (glow > 0) {
      ctx.strokeStyle = 'rgba(255,235,150,' + glow + ')'; ctx.lineWidth = 3;
      for (var i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(x + w * .5, y + h * .5, w * (.6 + i * .32), -1.0, 1.0);
        ctx.stroke();
      }
    }
  }

  function drawDomino(body) {
    partsOf(body).forEach(function (p) {
      pathBody(p);
      ctx.fillStyle = '#f7f4ec'; ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
    });
    var c = body.position;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(body.angle);
    ctx.fillStyle = '#c0392b';
    [[-2, -9], [2, 9]].forEach(function (d) {
      ctx.beginPath(); ctx.arc(d[0], d[1], 2.6, 0, 6.284); ctx.fill();
    });
    ctx.restore();
  }

  // Колесо рисуем само: его физические части — брусочки обода и спицы, и если
  // рисовать их как есть, получается «солнышко», а не колесо.
  function drawWheel(b) {
    var B = machine.bodies, R = B.wheelR, gap = B.wheelGap;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    var from = -Math.PI / 2 + gap, to = -Math.PI / 2 + Math.PI * 2 - gap;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7d5225'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(0, 0, R, from, to); ctx.stroke();
    ctx.strokeStyle = '#c08b4e'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(0, 0, R, from, to); ctx.stroke();
    ctx.strokeStyle = '#b8763f'; ctx.lineWidth = 7;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * (R - 5), Math.sin(a) * (R - 5)); ctx.stroke();
    }
    ctx.strokeStyle = '#d9a667'; ctx.lineWidth = 6;
    for (i = 0; i < 8; i++) {
      var b2 = i * Math.PI / 4 + Math.PI / 8;
      ctx.beginPath(); ctx.moveTo(Math.cos(b2) * (R - 30), Math.sin(b2) * (R - 30));
      ctx.lineTo(Math.cos(b2) * (R - 4), Math.sin(b2) * (R - 4)); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.284);
    ctx.fillStyle = '#6d4a24'; ctx.fill();
    ctx.strokeStyle = '#3f2a13'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // пол витрины
    var g = ctx.createLinearGradient(0, H - 120, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(0, H - 120, W, 120);

    // стойки-декор (за телами)
    ctx.fillStyle = 'rgba(120,134,158,.30)';
    machine.decor.forEach(function (d) { ctx.fillRect(d.x, d.y, d.w, d.h); });

    var bodies = Matter.Composite.allBodies(machine.world);
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (b.label === 'bell' || b.label === 'hamster' || b.label === 'domino' || b.label === 'wheel') continue;
      if (b.label === 'ballA' || b.label === 'ballB') {
        var rr = b.circleRadius, col = b.render.fillStyle, edge = b.render.strokeStyle;
        ctx.beginPath(); ctx.arc(b.position.x, b.position.y, rr, 0, 6.284);
        ctx.fillStyle = col; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.position.x - rr * .32, b.position.y - rr * .34, rr * .3, 0, 6.284);
        ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.position.x, b.position.y - rr);
        ctx.lineTo(b.position.x + rr * Math.sin(-b.angle), b.position.y - rr * Math.cos(-b.angle)); ctx.stroke();
        continue;
      }
      fill(b);
      var ps = partsOf(b);
      for (var j = 0; j < ps.length; j++) { pathBody(ps[j]); ctx.fill(); if (ctx.lineWidth) ctx.stroke(); }
    }

    for (i = 0; i < bodies.length; i++) {
      if (bodies[i].label === 'wheel') drawWheel(bodies[i]);
      if (bodies[i].label === 'domino') drawDomino(bodies[i]);
    }
    var bell = machine.bodies.bell; if (bell) drawBell(bell);
    var ham = machine.bodies.hamster; if (ham) drawHamster(ham);

    // Ближний обод поверх хомяка: без него он выглядит сидящим НА колесе,
    // а не бегущим внутри. Это только рисунок, физика не меняется.
    var wh = machine.bodies.wheel;
    if (wh && ham) {
      var dwh = Math.hypot(ham.position.x - wh.position.x, ham.position.y - wh.position.y);
      if (dwh < machine.bodies.wheelR + 34) {
        ctx.save();
        ctx.translate(wh.position.x, wh.position.y);
        ctx.rotate(wh.angle);
        ctx.strokeStyle = 'rgba(226,171,102,.85)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, machine.bodies.wheelR, 0, 6.284); ctx.stroke();
        ctx.strokeStyle = 'rgba(201,138,75,.7)'; ctx.lineWidth = 6;
        for (var k = 0; k < 3; k++) {
          var ak = 0.9 + k * 0.8;
          ctx.beginPath(); ctx.moveTo(Math.cos(ak) * 14, Math.sin(ak) * 14);
          ctx.lineTo(Math.cos(ak) * (machine.bodies.wheelR - 5), Math.sin(ak) * (machine.bodies.wheelR - 5));
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (bellFlash > 0) bellFlash = Math.max(0, bellFlash - 0.012);

    if (confetti) {
      confetti.t++;
      for (i = 0; i < confetti.list.length; i++) {
        var c = confetti.list[i];
        c.x += c.vx; c.y += c.vy; c.vy += 0.02; c.a += c.va;
        if (c.y > H + 20) { c.y = -20; c.x = (i * 97) % W; c.vy = 1.6 + (i % 7) * .4; }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
        ctx.fillStyle = c.c; ctx.globalAlpha = .92;
        ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- кнопки ---------- */

  elStart.addEventListener('click', function () {
    audio();
    if (machine.state().done) return;
    if (!running) { machine.start(); running = true; acc = 0; last = 0; seenLog = 0; pumpLog(); sync(); }
  });
  elReset.addEventListener('click', function () { boot(); });

  boot();
  requestAnimationFrame(frame);

  /* ---------- API для headless-приёмки ---------- *
   * run() считает полный прогон СИНХРОННО, без rAF: виртуальное время в
   * headless-браузере кадры не двигает, поэтому поведение проверяется так.  */
  window.__t = {
    run: function (maxSec) {
      var m = createMachine(Matter);
      m.settle(); m.start();
      var cap = (maxSec || 40) * 60, i = 0, s;
      while (i < cap) { m.tick(); i++; s = m.state(); if (s.done || s.failed) break; }
      s = m.state();
      return { ok: !!s.done, steps: i, stage: s.stage, stageName: s.stageName,
               failed: s.failed || null, doneCount: s.doneCount, total: s.total,
               flags: s.flags, dump: m.dump() };
    },
    dump: function () { return machine.dump(); },
    state: function () { return machine.state(); },
    // Прокручивает ПОКАЗЫВАЕМУЮ машину синхронно и перерисовывает:
    // headless-браузер не двигает rAF, а скриншоты нужды в реальном кадре.
    play: function (seconds) {
      var st = machine.state();
      if (!st.running && !st.done && !st.failed) { machine.start(); running = true; seenLog = 0; }
      var cap = Math.round((seconds || 0) * 60);
      for (var i = 0; i < cap; i++) {
        machine.tick();
        if (machine.state().done || machine.state().failed) { running = false; break; }
      }
      pumpLog(); sync(); draw();
      return machine.state();
    }
  };
})();
