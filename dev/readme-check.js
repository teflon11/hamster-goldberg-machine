const fs = require('fs');
const path = require('path');
const P = require('./paths');
const html = fs.readFileSync(P.INDEX, 'utf8');
const core = fs.readFileSync(path.join(P.SRC, 'core.js'), 'utf8');
const createMachine = require('./src/core.js');
const Matter = require('matter-js');

const m = createMachine(Matter);
const all = Matter.Composite.allBodies(m.world);
const dyn = all.filter(b => !b.isStatic);

console.log('тел всего:', all.length, '| динамических:', dyn.length);
console.log('динамические:', dyn.map(b => b.label).join(', '));

const checks = {
  'в HTML нет @keyframes': !/@keyframes/.test(html),
  'в HTML нет CSS transition': !/transition\s*:/.test(html),
  'в ядре нет присваиваний body.position =': !/\.position\s*=\s*\{/.test(core),
  'в ядре нет setVelocity/setPosition': !/Body\.(setPosition|setVelocity|setAngularVelocity)/.test(core),
  'Math.random в ядре отсутствует': !/Math\.random/.test(core),
  'шаг фиксированный': /Engine\.update\(engine, STEP\)/.test(core) && /STEP = 1000 \/ 60/.test(core),
  'Runner не используется': !/Runner/.test(core),
  'setStatic не используется': !/setStatic/.test(core),
  'EXCEPTION-пометок': (core.match(/EXCEPTION/g) || []).length
};
for (const k of Object.keys(checks)) console.log(`  ${checks[k] === true ? 'ok  ' : checks[k] === false ? 'ПЛОХО' : checks[k]} ${k}`);
