const createMachine = require('./src/core.js');
const Matter = require('matter-js');

const RUNS = parseInt(process.argv[2] || '5', 10);
const trace = process.argv.includes('--trace');
const every = (() => { const i = process.argv.indexOf('--every'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 20; })();

if (process.argv.includes('--rest')) {
  const m = createMachine(Matter);
  m.settle();
  console.log('REST', JSON.stringify(m.dump()));
  const B = m.bodies;
  const rep = (n, b) => b && console.log(`  ${n.padEnd(9)} pos=(${b.position.x.toFixed(1)},${b.position.y.toFixed(1)}) ang=${b.angle.toFixed(4)} m=${b.mass.toFixed(2)} v=${b.speed.toFixed(3)}`);
  ['ballA', 'beam', 'wheel', 'hamster'].forEach(k => rep(k, B[k]));
  B.dominoes.forEach((d, i) => rep('dom' + i, d));
  process.exit(0);
}

let pass = 0;
for (let run = 1; run <= RUNS; run++) {
  const m = createMachine(Matter);
  m.start();
  let lastStage = -1, steps = 0;
  const maxSteps = 60 * 90;
  while (!m.state().done && !m.state().failed && steps < maxSteps) {
    m.tick(); steps++;
    const st = m.state();
    if (st.stage !== lastStage) {
      const p = m.stages[st.stage - 1];
      console.log(`  run${run}: этап ${st.stage - 1} «${p ? p.name : ''}» пройден на t=${(steps / 60).toFixed(2)}s`);
      lastStage = st.stage;
    }
    if (trace && steps % every === 0) {
      const d = m.dump();
      console.log(`   t=${(steps / 60).toFixed(2)} s=${st.stage} A=${d.ballA} dom=${d.dom} beam=${d.beam} bell=${d.bell} ham=${d.ham} wh=${d.wheel}`);
    }
  }
  const st = m.state();
  if (st.done) { console.log(`run ${run}: OK (${st.seconds.toFixed(1)}s, ${st.doneCount}/${st.total} этапов)`); pass++; }
  else console.log(`run ${run}: FAIL — ${st.failed || 'тайм-аут'} | встало на этапе ${st.stage}: ${st.stageName}\n   ${JSON.stringify(m.dump())}`);
}
console.log(`\n== ${pass}/${RUNS} успешных прогонов ==`);
process.exit(pass === RUNS ? 0 : 1);
