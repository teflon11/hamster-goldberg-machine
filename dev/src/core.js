/*
 * Экспонат №7 — машина Голдберга «Разбудить хомяка».
 * Физическое ядро: не зависит от DOM, один и тот же код гоняется в Node (приёмка)
 * и в браузере (витрина).
 *
 * Движение тел — только из Engine.update() фиксированным шагом 1/60.
 * Скриптового перемещения тел нет. Исключения помечены «EXCEPTION» и оформлены
 * как импульс/сила телу, а не как перестановка координат.
 *
 * Что учтено в геометрии (свойства Matter, на которые сцена наткнулась):
 *  1. Тело-родитель составного тела сталкивается по ВЫПУКЛОЙ ОБОЛОЧКЕ частей, и
 *     его broadphase-границы — границы этой оболочки. Составным телом нельзя
 *     сделать чашку с выемкой: фантомная горбина выталкивает собственный шарик.
 *  2. Body._totalProperties суммирует инерцию частей вокруг ИХ центров без
 *     параллельного переноса (m*d^2) — момент занижен, шарнир вдали от центра
 *     масс взрывается.
 *  3. Одиночный прямоугольник на вынесенной оси устойчив, составное тело на
 *     вынесенной оси — нет. Все рычаги здесь — одиночные прямоугольники;
 *     составное тело одно (колесо) и его ось совпадает с центром масс.
 *  4. Шарнир + вторая опора на том же теле = переизбыточная связь, Matter
 *     решает её мгновенным выбросом. Либо шарнир, либо опорный контакт.
 */
function createMachine(Matter) {
  var Engine = Matter.Engine,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector;

  var W = 1600, H = 900;
  var STEP = 1000 / 60;
  var SETTLE = 150;
  var STAGE_LIMIT = 8;
  var TOTAL_LIMIT = 75;

  var engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 10;
  engine.velocityIterations = 10;
  engine.constraintIterations = 6;
  var world = engine.world;

  var B = {}, decor = [], log = [], flags = {};
  var t = 0, running = false, settled = false, finished = false, failed = null;
  var bellRang = false, hamsterAwake = false, wheelSpin = 0, lastWheelAngle = 0, wakePush = 0;

  /* ---------- помощники ---------- */

  function srect(x, y, w, h, angle, color) {
    return Bodies.rectangle(x, y, w, h, {
      isStatic: true, angle: angle || 0, friction: 0.5, restitution: 0.05,
      render: { fillStyle: color || '#5b6472', strokeStyle: '#39404b', lineWidth: 2 }
    });
  }

  function pin(body, ax, ay) {
    return Constraint.create({
      bodyA: body, pointA: Vector.sub(Vector.create(ax, ay), body.position),
      pointB: Vector.create(ax, ay), length: 0, stiffness: 1,
      render: { visible: false }
    });
  }

  function compound(parts, opts, density) {
    var body = Body.create(Object.assign({ parts: parts }, opts));
    Body.setDensity(body, density);
    var I = 0;
    for (var i = 1; i < body.parts.length; i++) {
      var p = body.parts[i];
      var dx = p.position.x - body.position.x, dy = p.position.y - body.position.y;
      I += p.inertia + p.mass * (dx * dx + dy * dy);
    }
    Body.setInertia(body, I);
    return body;
  }
  function post(x, y, w, h) { decor.push({ x: x, y: y, w: w, h: h }); }

  /* ---------- рамка сцены ---------- */

  Composite.add(world, [
    srect(W / 2, H + 30, W + 600, 80, 0, '#2f3540'),
    srect(-40, H / 2, 80, H + 600, 0, '#2f3540'),
    srect(W + 40, H / 2, 80, H + 600, 0, '#2f3540')
  ]);

  /* ---------- ЭТАП 1–2: стартовый шарик и наклонная плоскость ---------- */

  var RAMP_A = 0.58;                           // ~33°
  B.rampA = srect(184, 203, 300, 18, RAMP_A, '#6f7c8c');
  B.lipA = srect(52, 100, 16, 70, RAMP_A, '#6f7c8c');

  var SHELF_A = 0.1576;                        // ~9°
  var shelfTop = function (x) { return 331.6 + (x - 570) * Math.tan(SHELF_A); };
  B.shelf = srect(570, 341.7, 520, 20, SHELF_A, '#6f7c8c');
  Composite.add(world, [B.rampA, B.lipA, B.shelf]);

  B.ballA = Bodies.circle(90, 106, 20, {
    density: 0.014, friction: 0.02, frictionAir: 0.001, restitution: 0.2, label: 'ballA',
    render: { fillStyle: '#e8413a', strokeStyle: '#8f1d19', lineWidth: 3 }
  });
  B.latch = srect(143, 137, 14, 46, RAMP_A, '#c9a227');   // стартовая щеколда
  Composite.add(world, [B.ballA, B.latch]);

  /* ---------- ЭТАП 3: домино ---------- */

  B.dominoes = [];
  for (var d = 0; d < 5; d++) {
    var dx = 520 + d * 26;
    // Тонкие (10 px) и скользкие: упав, они не мешают шарику катиться дальше,
    // а съедают всю его энергию, если стоят толстыми и с большим трением.
    var dom = Bodies.rectangle(dx, shelfTop(dx) - 15.2, 10, 30, {
      angle: SHELF_A, density: 0.0002, friction: 0.15, frictionStatic: 0.6,
      restitution: 0.02, label: 'domino',
      render: { fillStyle: '#f4f1e8', strokeStyle: '#2b2b2b', lineWidth: 2 }
    });
    B.dominoes.push(dom);
  }
  Composite.add(world, B.dominoes);

  /* ---------- ЭТАП 4: весы ----------
   * Коромысло — одиночная планка x 820..1300 на верхней проушине (950,430).
   * Центр масс (1060,488) ниже проушины и правее неё: в покое правый конец
   * опущен и лежит на правом ограничителе, левый (чаша) поднят и ловит шарик A.
   * Неподвижный упор (880,400) гасит снос шарика и держит его левее проушины.
   */

  B.beam = Bodies.rectangle(1055, 488, 470, 16, {
    density: 0.001, frictionAir: 0.02, friction: 0.6, label: 'beam',
    render: { fillStyle: '#8d6b3f', strokeStyle: '#5b4325', lineWidth: 2 }
  });
  Composite.add(world, [
    B.beam, pin(B.beam, 1000, 430),
    // Статичные щёчки люльки держат шарик A левее проушины при любом наклоне
    // коромысла. Ставим их БЛИЗКО к проушине: там чаша ходит вверх-вниз всего
    // ~13 px, и щёчки успевают накрыть шарик. Просвет между щёчками — шире
    // шарика, низ щёчек — выше поверхности чаши в её нижнем положении.
    srect(901, 420, 12, 100, 0, '#4a5260'),
    srect(957, 420, 12, 100, 0, '#4a5260'),
    srect(1260, 527, 60, 28, 0, '#4a5260'),   // правый ограничитель: на нём коромысло покоится
    srect(860, 533, 80, 28, 0, '#4a5260')     // левый ограничитель хода чаши вниз
  ]);
  post(992, 0, 16, 482);                          // потолок -> проушина коромысла
  post(897, 0, 10, 372); post(953, 0, 10, 372);   // подвесы щёчек люльки

  /* ---------- ЭТАП 6: колокольчик ----------
   * Колокол висит НАД подъёмным торцом коромысла. Любое дополнительное тело на
   * этом конце (молот, плечо рычага) своим весом не даёт чаше перевесить, а тут
   * момент передаётся напрямую: торец проходит ~55 px вверх и бьёт в колокол.
   */

  B.bell = srect(1275, 425, 66, 50, 0, '#f0c419');
  B.bell.label = 'bell';
  Composite.add(world, B.bell);
  post(1268, 0, 14, 402);   // потолок -> колокол

  /* ---------- ЭТАП 8–9: хомяк и колесо ---------- */

  B.ledge = srect(700, 600, 170, 20, 0, '#4f7a4a');
  B.hamster = Bodies.circle(700, 560, 26, {
    density: 0.0035, friction: 0.9, frictionStatic: 1, frictionAir: 0.01, restitution: 0.1,
    label: 'hamster',
    render: { fillStyle: '#d8a15c', strokeStyle: '#8a5f2c', lineWidth: 3 }
  });

  var WC = Vector.create(595, 756), WR = 95, wParts = [];
  for (var s = 0; s < 6; s++) wParts.push(Bodies.rectangle(WC.x, WC.y, WR * 1.9, 9, { angle: s * Math.PI / 6 }));
  // Обод замыкаем в кольцо (сегменты 38 при шаге 36 перекрываются), но верхний
  // сектор оставляем открытым: через него хомяк падает ВНУТРЬ колеса, а не
  // остаётся сидеть на его крыше. Открытый сектор = ±GAP_AROUND_UP от вертикали
  // вверх; рисуем обод в app.js по той же константе.
  var GAP = 0.62;
  for (var r = 0; r < 16; r++) {
    var a = r / 16 * Math.PI * 2;
    var dUp = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
    if (dUp < GAP) continue;
    wParts.push(Bodies.rectangle(WC.x + Math.cos(a) * WR, WC.y + Math.sin(a) * WR, 38, 14, { angle: a }));
  }
  B.wheelGap = GAP;
  B.wheel = compound(wParts, {
    frictionAir: 0.03, friction: 0.7, label: 'wheel',
    render: { fillStyle: '#b8763f', strokeStyle: '#7a4a22', lineWidth: 2 }
  }, 0.00022);
  // Седло: два неподвижных штыря по бокам от верха колеса. Ставим их на
  // расстоянии R+45 от оси — дальше половины диагонали самого штыря, иначе
  // штырь войдёт в выпуклую оболочку колеса и намертво его заклинит.
  Composite.add(world, [
    B.ledge, B.hamster, B.wheel, pin(B.wheel, WC.x, WC.y),
    srect(WC.x - 60, WC.y - 130, 20, 44, 0, '#4a5260'),
    srect(WC.x + 60, WC.y - 130, 20, 44, 0, '#4a5260')
  ]);
  post(587, 756, 16, 144);
  post(640, 612, 12, 288); post(760, 612, 12, 288);   // ножки тумбы хомяка
  B.wheelCenter = WC; B.wheelR = WR;

  /* ---------- столкновения ---------- */

  Events.on(engine, 'collisionStart', function (ev) {
    var pairs = ev.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i].bodyA.label, b = pairs[i].bodyB.label;
      var hit = function (x, y) { return (a === x && b === y) || (a === y && b === x); };
      if (!bellRang && hit('beam', 'bell')) { bellRang = true; log.push({ type: 'bell', step: t }); }
      if (hit('ballA', 'domino') || hit('ballA', 'beam') || hit('beam', 'bell')) log.push({ type: 'click', step: t });
    }
  });

  /* ---------- этапы ---------- */

  function fallen() {
    var c = 0;
    for (var i = 0; i < B.dominoes.length; i++) if (Math.abs(B.dominoes[i].angle) > 0.45) c++;
    return c;
  }
  function moved(b) { return Vector.magnitude(Vector.sub(b.position, b.start)); }

  var STAGES = [
    { id: 'release', name: 'Старт: шарик сорвался с горки', ok: function () { return moved(B.ballA) > 20; } },
    { id: 'ramp', name: 'Наклонная плоскость разогнала шарик', ok: function () { return B.ballA.position.x > 300; } },
    { id: 'domino', name: 'Лавина домино', ok: function () { return fallen() >= 5; } },
    { id: 'funnel', name: 'Шарик свалился в чашу весов', ok: function () { return B.ballA.position.x < 975 && B.ballA.position.y > 430; } },
    { id: 'scale', name: 'Чаша перевесила, коромысло качнулось', ok: function () { return B.beam.angle < -0.10; } },
    { id: 'bell', name: 'Подъёмный торец ударил в колокольчик', ok: function () { return bellRang; } },
    { id: 'hamster', name: 'Хомяк проснулся и прыгнул', ok: function () { return hamsterAwake && moved(B.hamster) > 45; } },
    { id: 'wheel', name: 'Хомяк побежал в колесе', ok: function () { return wheelSpin > 2.4; } }
  ];
  var stageIndex = 0, stageDeadline = STAGE_LIMIT;

  /* ---------- расселиться и запомнить покоящиеся позиции ---------- */

  function settle() {
    if (settled) return;
    for (var q = 0; q < SETTLE; q++) Engine.update(engine, STEP);
    ['ballA', 'hamster'].forEach(function (k) {
      if (B[k]) B[k].start = Vector.clone(B[k].position);
    });
    B.beamRest = B.beam.angle;
    settled = true;
  }

  /* ---------- публичный API ---------- */

  function start() {
    if (running || finished) return;
    settle();
    running = true; t = 0; stageIndex = 0; stageDeadline = STAGE_LIMIT;
    Composite.remove(world, B.latch);
    log.push({ type: 'start', step: 0 });
  }

  function nanCheck() {
    var all = Composite.allBodies(world);
    for (var i = 0; i < all.length; i++) {
      var p = all[i].position;
      if (!isFinite(p.x) || !isFinite(p.y)) return all[i].label || 'body#' + i;
    }
    return null;
  }

  function tick() {
    if (!running || finished) return;
    Engine.update(engine, STEP);
    t++;

    var bad = nanCheck();
    if (bad) { failed = 'разрыв симуляции (NaN) в теле ' + bad; running = false; log.push({ type: 'nan', step: t }); return; }

    wheelSpin += Math.abs(B.wheel.angle - lastWheelAngle);
    lastWheelAngle = B.wheel.angle;

    // EXCEPTION: пробуждение хомяка — импульс телу (как удар дятла).
    // Летит и падает он дальше только от гравитации и столкновений.
    if (bellRang && !hamsterAwake) {
      hamsterAwake = true; wakePush = 6;
      log.push({ type: 'wake', step: t });
    }
    // Толчок длится 6 шагов — как пружина в полу клетки, а не телепорт.
    // Подобран так, чтобы за ~40 шагов падения хомяк сместился на ~195 px влево,
    // то есть попал в центр колеса (505,745).
    if (wakePush > 0) {
      wakePush--;
      Body.applyForce(B.hamster, B.hamster.position, { x: -0.022, y: -0.011 });
    }

    // EXCEPTION: «бег в колесе» — ПАРА сил по касательной обода (равный момент,
    // ну resultant) пока хомяк внутри колеса. Одиночная сила ушла бы в ось и
    // почти не крутила: момент инерции колеса велик, нужен именно момент пары.
    if (hamsterAwake && wheelSpin < 2.6) {
      var dv = Vector.sub(B.hamster.position, B.wheelCenter);
      if (Vector.magnitude(dv) < B.wheelR + 45) {
        var n = Vector.normalise(dv);
        var t = { x: -n.y, y: n.x };
        var arm = B.wheelR * 0.85, RUN = 0.05;
        Body.applyForce(B.wheel, Vector.add(B.wheelCenter, Vector.mult(n, arm)), Vector.mult(t, RUN));
        Body.applyForce(B.wheel, Vector.sub(B.wheelCenter, Vector.mult(n, arm)), Vector.mult(t, -RUN));
      }
    }

    while (stageIndex < STAGES.length && STAGES[stageIndex].ok()) {
      flags[STAGES[stageIndex].id] = true;
      log.push({ type: 'stage', step: t, id: STAGES[stageIndex].id });
      stageIndex++;
      stageDeadline = t / 60 + STAGE_LIMIT;
    }

    if (stageIndex >= STAGES.length) { finished = true; running = false; log.push({ type: 'win', step: t }); return; }
    if (t / 60 > stageDeadline) { failed = STAGES[stageIndex].name; running = false; log.push({ type: 'stall', step: t, id: STAGES[stageIndex].id }); return; }
    if (t / 60 > TOTAL_LIMIT) { failed = 'общий тайм-аут машины'; running = false; }
  }

  function state() {
    return {
      running: running, finished: finished, failed: failed, settled: settled,
      seconds: t / 60, stage: stageIndex, stageName: STAGES[stageIndex] ? STAGES[stageIndex].name : '—',
      done: stageIndex >= STAGES.length, doneCount: stageIndex, total: STAGES.length,
      flags: flags, bell: bellRang, wheelSpin: wheelSpin, hamsterAwake: hamsterAwake
    };
  }

  function dump() {
    return {
      ballA: [B.ballA.position.x | 0, B.ballA.position.y | 0, +B.ballA.speed.toFixed(2)],
      dom: fallen(), beam: +B.beam.angle.toFixed(3),
      bell: bellRang,
      ham: [B.hamster.position.x | 0, B.hamster.position.y | 0],
      wheel: +wheelSpin.toFixed(2), st: state()
    };
  }

  return {
    engine: engine, world: world, bodies: B, stages: STAGES, decor: decor,
    start: start, tick: tick, state: state, dump: dump, log: log, settle: settle,
    W: W, H: H, STEP: STEP
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = createMachine;
if (typeof window !== 'undefined') window.createMachine = createMachine;
