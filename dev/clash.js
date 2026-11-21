const createMachine = require('./src/core.js');
const Matter = require('matter-js');

const m = createMachine(Matter);
const bodies = Matter.Composite.allBodies(m.world);
let n = 0;
for (let i = 0; i < bodies.length; i++) {
  for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.parent === b.parent) continue;
    if (a.isStatic && b.isStatic) continue;
    const hits = Matter.Query.collides(a, [b]);
    for (const h of hits) {
      const ov = h.penetration;
      const depth = ov ? Math.hypot(ov.x, ov.y) : 0;
      if (depth > 0.5) {
        console.log(`ПЕРЕСЕЧЕНИЕ: ${a.label.padEnd(12)} <-> ${b.label.padEnd(12)} глубина ${depth.toFixed(1)}`);
        n++;
      }
    }
  }
}
console.log(n ? `\n== ${n} пересечений при сборке ==` : '\n== сборка без пересечений ==');
process.exit(n ? 1 : 0);
