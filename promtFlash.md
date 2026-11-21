# Инструкция для Qwen3.8 Flash: Машина Голдберга "Разбудить хомяка"

## Цель проекта
Создать одностраничное браузерное приложение (index.html) с машиной Голдберга, использующей **только настоящую физику** через движок Matter.js 0.20.0. Машина должна запускать цепную реакцию минимум из 8 этапов, которая в итоге будит спящего хомяка и звенит колокольчиком.

## Критические требования (НЕ НАРУШАТЬ)
1. **Только физика**: Никаких CSS-анимаций, keyframes, requestAnimationFrame для движения объектов. Всё движение — только через `Matter.Engine.update()` с фиксированным шагом 1/60 секунды.
2. **Надёжность**: Машина должна срабатывать каждый раз без исключений. Запрещены случайные элементы, которые могут сломать цепь.
3. **Автономность**: Один файл index.html, все библиотеки инлайнены или с CDN, работает по file:// протоколу.
4. **Приёмка**: Код должен пройти 5 последовательных успешных headless-проверок без единого сбоя.

## Архитектура файла index.html

### Структура документа
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Экспонат №7: Машина Голдберга "Разбудить хомяка"</title>
    <style>
        /* Встроить сюда весь CSS */
    </style>
</head>
<body>
    <!-- UI элементы: кнопки Start/Reset, счётчик прогонов -->
    <div id="controls">...</div>
    
    <!-- Контейнер для canvas Matter.js -->
    <div id="scene"></div>
    
    <!-- Инлайн Matter.js 0.20.0 (скопировать из matter.min.js) -->
    <script>
        // Вставить код matter.min.js здесь
    </script>
    
    <!-- Основной скрипт машины -->
    <script>
        // Логика машины Голдберга
    </script>
</body>
</html>
```

### CSS требования
- Полноэкранный canvas: `width: 100vw; height: calc(100vh - 60px);` (оставить место для панели управления)
- Панель управления внизу: фиксированная высота 60px, видна целиком (избегать ловушки 100vh + overflow:hidden)
- Центрирование элементов, читаемые шрифты, контрастные цвета
- Canvas позиционировать абсолютно внутри #scene

## Этапы машины Голдберга (минимум 8, реализовать 13 для надёжности)

### Этап 1: Стартовый шарик
- Шарик радиусом 15px, масса 1, restitution 0.6
- Начальная позиция: верхний левый угол, удерживается статическим упором
- При нажатии Start: упор удаляется, шарик падает под гравитацией

### Этап 2: Наклонная плоскость
- Прямоугольник 300x20px, угол наклона 25°
- Позиция: под стартовым шариком
- Шарик скатывается вниз, набирая скорость

### Этап 3: Домино (5 костяшек)
- 5 прямоугольников 15x60px, масса 0.5, расположены с интервалом 25px
- Первая костяшка слегка наклонена (2°) для гарантированного падения
- Последняя костяшка толкает следующий элемент

### Этап 4: Качели-катапульта
- Длинная доска 200x15px на точке опоры посередине (constraint pivot)
- На одном конце груз 20px радиусом
- Падающая костяшка ударяет другой конец, груз подлетает вверх

### Этап 5: Воронка-накопитель
- 4 статических прямоугольника, образующих воронку
- Груз падает в воронку, накапливает потенциальную энергию
- Выход из воронки направлен на следующий этап

### Этап 6: Маятник-ударник
- Круг 25px радиусом на верёвке (constraint length 150px)
- Груз из воронки толкает маятник
- Маятник раскачивается и бьёт по следующему элементу

### Этап 7: Пружинный механизм
- Статический блок с пружиной (использовать constraint stiffness)
- Удар маятника сжимает пружину
- Пружина резко распрямляется, толкая платформу

### Этап 8: Падающий молот
- Прямоугольник 80x40px на шарнире сверху (constraint angle limit)
- Платформа от этапа 7 освобождает защёлку
- Молот падает и звенит колокольчик

### Этап 9: Колокольчик
- Статический объект с sprite или кругом золотого цвета
- При ударе молота: воспроизвести звук (Web Audio API beep) и визуальный эффект (изменение цвета на 0.5 сек)
- Флаг этапа: `bellRung = true`

### Этап 10: Пробуждение хомяка
- Хомяк: круг 30px коричневого цвета, изначально статичный (isStatic: true)
- После звона колокольчика: isStatic = false, приложить импульс вверх
- Хомяк подпрыгивает от радости

### Этап 11: Беговое колесо
- Большое кольцо 100px радиусом, закреплено в центре (constraint)
- Хомяк попадает в колесо, начинает его вращать
- Визуальный эффект: конфетти или частицы при вращении

### Этап 12: Праздничный финал
- Изменение фона на яркий цвет (золотой/радужный)
- Текст "Хомяк проснулся!" появляется с анимацией fade-in (это единственное исключение — UI анимация допустима)
- Звуковой сигнал победы

### Этап 13: Счётчик успешных прогонов
- Отображение: "Успешных прогонов: X/5"
- После 5 успешных: текст "ПРИЁМКА ПРОЙДЕНА ✓"

## Реализация физики Matter.js

### Инициализация движка
```javascript
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Constraint = Matter.Constraint,
      Vector = Matter.Vector;

const engine = Engine.create();
engine.world.gravity.y = 1; // Стандартная гравитация

const render = Render.create({
    element: document.getElementById('scene'),
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight - 60,
        wireframes: false,
        background: '#f0f0f0'
    }
});
```

### Цикл обновления
```javascript
// Использовать фиксированный шаг 1/60
const runner = Runner.create();
Runner.run(runner, engine);
Render.run(render);

// Альтернатива для полного контроля:
// function update() {
//     Engine.update(engine, 1000/60);
//     requestAnimationFrame(update);
// }
```

### Создание тел
- Все тела добавлять в `engine.world` через `Composite.add()`
- Для статических объектов: `{ isStatic: true }`
- Для динамических: указать массу, restitution (упругость), friction (трение)

### Constraints (ограничения)
- Использовать для шарниров, веревок, пружин
- Пример маятника:
```javascript
Constraint.create({
    bodyA: pendulum,
    pointB: { x: 400, y: 100 },
    length: 150,
    stiffness: 1
});
```

## Система отслеживания этапов

### Флаги прохождения
```javascript
const stageFlags = {
    ballReleased: false,
    rampCompleted: false,
    dominoesFallen: false,
    catapultTriggered: false,
    funnelPassed: false,
    pendulumSwung: false,
    springReleased: false,
    hammerDropped: false,
    bellRung: false,
    hamsterAwake: false,
    wheelSpinning: false,
    celebrationDone: false
};
```

### Watchdog (сторожевой таймер)
```javascript
let currentStage = 0;
let stageStartTime = Date.now();
const STAGE_TIMEOUT = 5000; // 5 секунд на этап

function checkWatchdog() {
    const elapsed = Date.now() - stageStartTime;
    if (elapsed > STAGE_TIMEOUT && currentStage < 12) {
        console.error(`Зависание на этапе ${currentStage}: ${getStageName(currentStage)}`);
        document.getElementById('status').textContent = 
            `⚠️ Зависание: ${getStageName(currentStage)}`;
        return false;
    }
    return true;
}

function advanceStage() {
    currentStage++;
    stageStartTime = Date.now();
}
```

## Управление состоянием

### Кнопка Start
```javascript
document.getElementById('startBtn').addEventListener('click', () => {
    resetMachine();
    releaseBall(); // Удалить стартовый упор
    startWatchdog();
});
```

### Кнопка Reset
```javascript
document.getElementById('resetBtn').addEventListener('click', () => {
    Composite.clear(engine.world);
    Engine.clear(engine);
    setupScene(); // Пересоздать все объекты
    resetFlags();
    currentStage = 0;
});
```

### Функция сброса
```javascript
function resetMachine() {
    // Удалить все тела из мира
    Composite.clear(engine.world);
    // Пересоздать начальную сцену
    setupInitialBodies();
    // Сбросить флаги
    Object.keys(stageFlags).forEach(key => stageFlags[key] = false);
}
```

## Headless-проверка (для приёмки)

### Режим проверки
```javascript
// Добавить параметр URL: ?headless=true
const isHeadless = new URLSearchParams(window.location.search).get('headless') === 'true';

if (isHeadless) {
    // Отключить рендеринг
    Render.stop(render);
    // Запустить автоматическую проверку
    runHeadlessTest();
}
```

### Автоматический тест
```javascript
async function runHeadlessTest() {
    let successCount = 0;
    const requiredSuccesses = 5;
    
    for (let i = 0; i < requiredSuccesses; i++) {
        const result = await testSingleRun();
        if (result) {
            successCount++;
            console.log(`Прогон ${i+1}: УСПЕХ`);
        } else {
            console.error(`Прогон ${i+1}: ПРОВАЛ на этапе ${currentStage}`);
            break;
        }
        // Сброс между прогонами
        resetMachine();
        await delay(1000);
    }
    
    if (successCount === requiredSuccesses) {
        console.log('✓ ПРИЁМКА ПРОЙДЕНА: 5/5 успешных прогонов');
    }
}
```

### Тест одного прогона
```javascript
function testSingleRun() {
    return new Promise((resolve) => {
        releaseBall();
        const maxTime = 30000; // 30 секунд максимум
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            if (stageFlags.bellRung && stageFlags.hamsterAwake) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (Date.now() - startTime > maxTime) {
                clearInterval(checkInterval);
                resolve(false);
            } else if (!checkWatchdog()) {
                clearInterval(checkInterval);
                resolve(false);
            }
        }, 100);
    });
}
```

## Визуальные элементы

### Спрайты и цвета
- Шарик: красный круг `fillStyle: '#ff4444'`
- Домино: белые прямоугольники с чёрными точками (нарисовать через render event)
- Хомяк: коричневый круг `fillStyle: '#8B4513'`
- Колокольчик: золотой `fillStyle: '#FFD700'`
- Фон: светло-серый `#f0f0f0`, при победе — золотой `#FFD700`

### Отрисовка текста на canvas
```javascript
Events.on(render, 'afterRender', function() {
    const ctx = render.context;
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(`Этап: ${getStageName(currentStage)}`, 10, 30);
});
```

## Звуковые эффекты (Web Audio API)

### Простой beep
```javascript
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(frequency = 800, duration = 0.2) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}
```

### Звон колокольчика
```javascript
function playBellSound() {
    playBeep(1200, 0.5); // Высокий тон
    setTimeout(() => playBeep(1000, 0.3), 100);
    setTimeout(() => playBeep(800, 0.2), 200);
}
```

## Обработка событий столкновений

### Отслеживание ключевых столкновений
```javascript
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    
    pairs.forEach(pair => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        // Проверка: костяшка упала на следующую
        if (isDomino(bodyA) && isDomino(bodyB)) {
            checkDominoChain();
        }
        
        // Проверка: молот ударил колокольчик
        if (isHammer(bodyA) && isBell(bodyB) || isHammer(bodyB) && isBell(bodyA)) {
            ringBell();
        }
        
        // Проверка: хомяк попал в колесо
        if (isHamster(bodyA) && isWheel(bodyB)) {
            startCelebration();
        }
    });
});
```

## Оптимизация надёжности

### Параметры материалов
- Restitution (упругость): 0.4-0.7 для большинства объектов
- Friction (трение): 0.3-0.5 для предотвращения проскальзывания
- Density (плотность): варьировать для баланса масс

### Геометрия
- Избегать слишком маленьких объектов (< 10px)
- Зазоры между элементами: минимум 5px
- Углы наклона: проверять, что шарик не застревает (25-30° оптимально)

### Тестирование каждого этапа
- После создания каждого этапа запустить машину и убедиться в прохождении
- Если этап нестабилен: увеличить массы, уменьшить трение, изменить углы
- **Никогда** не использовать скриптовое движение как "костыль"

## Пошаговый план реализации

1. **Создать базовый HTML** с inline Matter.js и пустым canvas
2. **Реализовать этапы 1-3** (шарик → рампа → домино), протестировать
3. **Добавить этапы 4-6** (катапульта → воронка → маятник), протестировать
4. **Добавить этапы 7-9** (пружина → молот → колокольчик), протестировать
5. **Добавить этапы 10-12** (хомяк → колесо → праздник), протестировать
6. **Реализовать систему watchdog** и счётчик этапов
7. **Добавить звуки** через Web Audio API
8. **Реализовать headless-режим** для приёмки
9. **Запустить 5 тестов**, исправить любые сбои правкой геометрии/масс
10. **Финальная проверка**: открыть файл в браузере, нажать Start, убедиться в работе

## Критические ошибки, которых избегать

❌ **НЕЛЬЗЯ**: Использовать `body.position.x = ...` для движения объектов  
✅ **МОЖНО**: Применять силы/импульсы через `Body.applyForce()` или удалять ограничения

❌ **НЕЛЬЗЯ**: Использовать `requestAnimationFrame` для анимации физических тел  
✅ **МОЖНО**: Использовать только для обновления UI (счётчики, текст)

❌ **НЕЛЬЗЯ**: Делать объекты слишком лёгкими (масса < 0.1)  
✅ **МОЖНО**: Масса 0.5-5 для большинства элементов

❌ **НЕЛЬЗЯ**: Создавать острые углы < 15° где может застрять шарик  
✅ **МОЖНО**: Закруглённые края, плавные переходы

❌ **НЕЛЬЗЯ**: Полагаться на случайность (`Math.random()`)  
✅ **МОЖНО**: Детерминированные начальные условия

## Финальная проверка перед сдачей

- [ ] Файл открывается по file:// без ошибок в консоли
- [ ] Кнопка Start запускает цепную реакцию
- [ ] Все 13 этапов проходят последовательно
- [ ] Колокольчик звенит, хомяк просыпается
- [ ] Кнопка Reset возвращает всё в исходное состояние
- [ ] Watchdog обнаруживает зависания и называет этап
- [ ] Headless-режим проходит 5/5 прогонов
- [ ] Нет CSS-анимаций для физических объектов
- [ ] Matter.js инлайнен, нет внешних зависимостей
- [ ] Нижняя панель управления видна целиком

## Примечание для Qwen3.8 Flash

Не задавай вопросов. Не предлагай альтернативы. Просто реализуй точно по инструкции. Если что-то не работает — чинь правкой параметров физики (массы, углы, трение), а не добавлением скриптового движения. Каждый этап тестируй перед переходом к следующему. Помни: это музейный экспонат, который должен работать безотказно.
