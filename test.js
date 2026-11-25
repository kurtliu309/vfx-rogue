'use strict';
const assert = require('assert');
const V = require('./engine.js');
const S = require('./story.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name); console.error(e && e.stack ? e.stack : e); process.exitCode = 1; throw e; }
}
const grid = (rows, cols) => V.emptyGrid(rows || 2, cols || 6);
const put = (g, r, c, type, o) => (g[r][c] = V.makeCard(type, o || {}));
const brief = (hero, minStars, reqs) => ({ kind: 'gig', hero, minStars, reqs: (reqs || []).map(id => typeof id === 'string' ? { id } : id), revealed: [] });

console.log('Node Rogue v2 · engine tests');

test('chain: Box → Pyro Source → Pyro Solver → Light → Comp gives stars from depth + sim', () => {
  const g = grid(1, 5);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc'); put(g, 0, 2, 'pyro'); put(g, 0, 3, 'light'); put(g, 0, 4, 'comp');
  const ev = V.evaluate(g, { solverResults: { '0,2': { bonus: 1 } } });
  const s = ev.rowOut[0];
  assert.ok(s.lit && s.final);
  assert.strictEqual(V.streamStars(s, [], 'fire'), 3);
  assert.strictEqual(s.polish, -1, 'grey model lit = -1 polish');
});

test('pipeline caps: unlit ★2, lit-no-comp ★3.5', () => {
  const g = grid(1, 5);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc'); put(g, 0, 2, 'pyro'); put(g, 0, 3, 'turb');
  let ev = V.evaluate(g, { solverResults: { '0,2': { bonus: 2 } } });
  assert.strictEqual(V.streamStars(ev.rowOut[0], [], 'fire'), 2);
  put(g, 0, 4, 'light');
  ev = V.evaluate(g, { solverResults: { '0,2': { bonus: 2 } } });
  assert.strictEqual(V.streamStars(ev.rowOut[0], [], 'fire'), 3.5);
});

test('dependency: Turbulence without Pyro Solver errors like Houdini', () => {
  const g = grid(1, 3);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc'); put(g, 0, 2, 'turb');
  const ev = V.evaluate(g, {});
  assert.strictEqual(ev.cells[0][2].status, 'err');
  assert.strictEqual(ev.cells[0][2].err, 'err.needStep');
  assert.strictEqual(ev.rowOut[0], null);
});

test('empty cells are wires; nodes with no input error', () => {
  const g = grid(1, 4);
  put(g, 0, 0, 'box'); put(g, 0, 3, 'light');
  let ev = V.evaluate(g, {});
  assert.ok(ev.rowOut[0].lit);
  const g2 = grid(1, 2); put(g2, 0, 1, 'light');
  ev = V.evaluate(g2, {});
  assert.strictEqual(ev.cells[0][1].err, 'err.noInput');
});

test('merge brings a plate in; Plate Integrate needs it', () => {
  const g = grid(2, 5);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'popsrc'); put(g, 0, 2, 'light'); put(g, 0, 3, 'merge'); put(g, 0, 4, 'plateint');
  put(g, 1, 0, 'plate');
  const ev = V.evaluate(g, {});
  const s = ev.rowOut[0];
  assert.ok(s.plate && s.onPlate && s.final);
  const g2 = grid(1, 3); put(g2, 0, 0, 'box'); put(g2, 0, 1, 'light'); put(g2, 0, 2, 'plateint');
  assert.strictEqual(V.evaluate(g2, {}).cells[0][2].err, 'err.needPlate');
});

test('diverged solver kills the stream; Roto Rescue revives one step lower', () => {
  const g = grid(1, 6);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'flipsrc'); put(g, 0, 2, 'flip'); put(g, 0, 3, 'light');
  let ev = V.evaluate(g, { solverResults: { '0,2': { diverged: true } } });
  assert.strictEqual(ev.cells[0][3].err, 'err.deadInput');
  const g2 = grid(1, 6);
  put(g2, 0, 0, 'box'); put(g2, 0, 1, 'flipsrc'); put(g2, 0, 2, 'flip'); put(g2, 0, 3, 'roto'); put(g2, 0, 4, 'light'); put(g2, 0, 5, 'comp');
  ev = V.evaluate(g2, { solverResults: { '0,2': { diverged: true } } });
  const s = ev.rowOut[0];
  assert.ok(s && !s.dead);
  assert.strictEqual(s.step.water, 1);
});

test('look-dev: Sculpt + Skin is a match (+1), Metal on Sculpt is a mismatch (−1)', () => {
  const g = grid(1, 2); put(g, 0, 0, 'sculpt'); put(g, 0, 1, 'skin');
  assert.strictEqual(V.evaluate(g, {}).rowOut[0].polish, 1);
  const g2 = grid(1, 2); put(g2, 0, 0, 'sculpt'); put(g2, 0, 1, 'metal');
  assert.strictEqual(V.evaluate(g2, {}).rowOut[0].polish, -1);
  assert.strictEqual(V.evaluate(g, { relics: ['lookdev'] }).rowOut[0].polish, 2);
});

test('creature chain needs organic geo; anim boosts later FX solvers', () => {
  const g = grid(1, 3); put(g, 0, 0, 'box'); put(g, 0, 1, 'rig');
  assert.strictEqual(V.evaluate(g, {}).cells[0][1].err, 'err.needOrganic');
  const g2 = grid(1, 6);
  put(g2, 0, 0, 'sculpt'); put(g2, 0, 1, 'rig'); put(g2, 0, 2, 'animate'); put(g2, 0, 3, 'flipsrc'); put(g2, 0, 4, 'flip'); put(g2, 0, 5, 'light');
  const s = V.evaluate(g2, { solverResults: { '0,4': { bonus: 0 } } }).rowOut[0];
  assert.strictEqual(s.step.creature, 2);
  assert.strictEqual(s.bonus.water, 0.5);
});

test('grading: pass / fail / grade letters', () => {
  const g = grid(1, 6);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'shader'); put(g, 0, 2, 'fracture'); put(g, 0, 3, 'rbd'); put(g, 0, 4, 'threept'); put(g, 0, 5, 'grade');
  const ev = V.evaluate(g, { solverResults: { '0,3': { bonus: 1 } }, brief: brief('destr', 2, ['lit', 'tex', 'final']) });
  assert.ok(ev.best.pass);
  // stars 3, over 1 → 2 pts + polish (threept 1 + grade 1) = 4 → B (A = 6, S = 9)
  assert.strictEqual(ev.best.stars, 3);
  assert.strictEqual(ev.best.grade, 'B');
  const ev2 = V.evaluate(g, { solverResults: { '0,3': { bonus: 1 } }, brief: brief('fire', 1, ['lit']) });
  assert.ok(!ev2.best.pass);
  assert.ok(ev2.best.missing.includes('hero'));
});

test('quality tiers add hours/RAM/risk; hero tiers add +0.5★ and fail to a weaker take', () => {
  const c = V.makeCard('turb', { q: 3 });
  assert.strictEqual(V.cardHours(c), 3);
  assert.strictEqual(V.cardRam(c), 8);
  assert.strictEqual(V.cardRisk(c), 0.25);
  const g = grid(1, 6);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc', { q: 3 }); put(g, 0, 2, 'light'); put(g, 0, 3, 'comp');
  assert.strictEqual(V.streamStars(V.evaluate(g, {}).rowOut[0], [], 'fire'), 2);
  const fails = { '0,1': true };
  const weak = V.evaluate(g, { fails }).rowOut[0];
  // A failed hero quality roll keeps the step (no broken chain) but loses its
  // tier bonus and half a star.
  assert.strictEqual(weak.step.fire, 1);
  assert.strictEqual(V.streamStars(weak, [], 'fire'), 0.5);
});

test('specialist relics: +0.5★, +1★ when the element is alone', () => {
  const g = grid(1, 4);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc'); put(g, 0, 2, 'light'); put(g, 0, 3, 'comp');
  const s = V.evaluate(g, {}).rowOut[0];
  assert.strictEqual(V.streamStars(s, ['nerd_fire'], 'fire'), 2);
});

test('sim: instability grows, collision tames it, detail → bonus', () => {
  const card = V.makeCard('pyro');
  const p1 = V.simParams(card, {}), p2 = V.simParams(card, { collision: true });
  assert.ok(p2.inst < p1.inst);
  const rng = V.mulberry32(7);
  const st = V.simInit(p1, 7);
  while (!st.done) V.simStep(st, rng);
  assert.ok(st.f > 0);
  assert.strictEqual(V.simBonus(0), 0);
  assert.strictEqual(V.simBonus(65), 1);
  assert.strictEqual(V.simBonus(130), 2);
  assert.ok(V.simPredict(p1) < (V.simPredict(p2) || 999));
});

function newJobGame(bg) {
  const g = new V.Game(42).start(bg || 'pyro');
  g.inbox.forEach((m, i) => { if (m.choices) g.resolveEvent(i, 0); });
  assert.ok(g.toBoard());
  return g;
}
const uidOf = (g, type, skip) => g.cards.filter(c => c.type === type)[skip || 0].uid;

test('game: tutorial job, cook, notes, caching makes re-cooks free', () => {
  const g = newJobGame('pyro');
  assert.strictEqual(g.board.gigs.length, 1);
  assert.ok(g.chooseJob('gig', 0).ok);
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'pyrosrc'), 0, 1); g.place(uidOf(g, 'light'), 0, 2);
  const pre = g.preview();
  assert.strictEqual(pre.cost, 3);
  const r = g.commitCook({});
  assert.ok(r.ok, r.reason);
  assert.ok(r.notes.lines.length >= 1);
  assert.strictEqual(g.job.hoursLeft, g.job.hoursTotal - 3);
  const pre2 = g.preview();
  assert.strictEqual(pre2.cost, 0, 'nothing changed → all cached');
  g.place(uidOf(g, 'comp'), 0, 3);
  assert.strictEqual(g.preview().cost, 1, 'only the new node cooks');
  g.setQuality(uidOf(g, 'pyrosrc'), 2);
  assert.strictEqual(g.preview().cost, 2 + 1 + 1, 'changing an upstream node invalidates downstream');
  const d = g.deliver();
  assert.ok(d.ok);
});

test('game: RAM per column blocks cooking (OOM)', () => {
  const g = newJobGame('water');
  g.chooseJob('gig', 0);
  g.cards.push(V.makeCard('flip'));
  const flips = g.cards.filter(c => c.type === 'flip');
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'box', 1), 1, 0);
  g.place(flips[0].uid, 0, 1); g.place(flips[1].uid, 1, 1);
  const p = g.prepareCook();
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.reason, 'err.oom');
});

test('game: hours budget and render farm', () => {
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.job.hoursLeft = 1;
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'pyrosrc'), 0, 1); g.place(uidOf(g, 'light'), 0, 2);
  assert.strictEqual(g.prepareCook().reason, 'err.hours');
  const cash = g.cash;
  assert.ok(g.rentFarm().ok);
  assert.strictEqual(g.cash, cash - V.CONFIG.farmBasePrice);
  assert.ok(g.prepareCook().ok);
});

test('notes: “bigger” client raises the bar once; secret client reveals a requirement', () => {
  const rng = V.mulberry32(3);
  const b = { kind: 'gig', client: 'brightburn', hero: 'fire', minStars: 2, reqs: [{ id: 'lit' }], revealed: [] };
  const n = V.notesFor(b, { pass: true, missing: [], grade: 'B' }, 0, rng);
  assert.strictEqual(b.minStars, 3);
  V.notesFor(b, { pass: true, missing: [], grade: 'B' }, 1, rng);
  assert.strictEqual(b.minStars, 3);
  assert.strictEqual(n.persona, 'bigger');
  const b2 = { kind: 'gig', client: 'vale', hero: 'magic', minStars: 1, reqs: [{ id: 'lit' }], hidden: { id: 'night' }, revealed: [] };
  V.notesFor(b2, { pass: true, missing: [], grade: 'C' }, 0, rng);
  assert.strictEqual(b2.revealed[0].id, 'night');
});

test('reel gates', () => {
  const gate = V.reelGate('halcyon');
  const reel = [{ stars: 3, el: 'fire' }, { stars: 4, el: 'fire' }, { stars: 3, el: 'water', nda: true }];
  assert.strictEqual(V.checkGate(gate, reel).ok, false);
  reel.push({ stars: 3.5, el: 'water' });
  assert.strictEqual(V.checkGate(gate, reel).ok, true);
});

test('economy: rent, eviction, hardware shop', () => {
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'light'), 0, 1);
  g.commitCook({}); g.deliver();
  g.cash = 2000;
  g.toWeekend();
  assert.strictEqual(g.phase, 'weekend');
  assert.strictEqual(g.cash, 2000 - g.rentDue());
  const cols = g.hw.cols;
  assert.ok(g.buy('cpu').ok);
  assert.strictEqual(g.hw.cols, cols + 1);
  g.nextWeek();
  assert.strictEqual(g.week, 2);
  // eviction
  const g2 = newJobGame('pyro'); g2.chooseJob('gig', 0); g2.place(uidOf(g2, 'box'), 0, 0); g2.place(uidOf(g2, 'light'), 0, 1); g2.commitCook({}); g2.deliver();
  g2.cash = 10; g2.toWeekend();
  assert.strictEqual(g2.phase, 'ending');
  assert.strictEqual(g2.ending.id, 'evicted');
});

test('HDA packs two nodes into one cell', () => {
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'light'), 0, 1); g.commitCook({}); g.deliver(); g.cash = 5000; g.toWeekend();
  g.relics.push('hda');
  const a = uidOf(g, 'pyrosrc'), b = uidOf(g, 'pyro');
  assert.ok(g.buy('hda', a, b).ok);
  const h = g.cards.find(c => c.parts);
  assert.deepStrictEqual(h.parts, ['pyrosrc', 'pyro']);
  const gr = grid(1, 4); gr[0][0] = V.makeCard('box'); gr[0][1] = h; gr[0][2] = V.makeCard('light');
  const s = V.evaluate(gr, { solverResults: { '0,1': { bonus: 0.5 } } }).rowOut[0];
  assert.strictEqual(s.step.fire, 2);
  assert.strictEqual(V.cardHours(h), 2);
});

test('polish: same source counts once; quality-tier polish counts per node', () => {
  const g = grid(1, 5);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'shader'); put(g, 0, 2, 'light');
  put(g, 0, 3, 'grade'); put(g, 0, 4, 'grade');
  assert.strictEqual(V.evaluate(g, {}).rowOut[0].polish, 1, 'two Grades = one Grade of polish');
  const g2 = grid(1, 5);
  put(g2, 0, 0, 'box'); put(g2, 0, 1, 'shader'); put(g2, 0, 2, 'light');
  put(g2, 0, 3, 'lens'); put(g2, 0, 4, 'lens');
  assert.strictEqual(V.evaluate(g2, {}).rowOut[0].polish, 1, 'two Lens nodes = one Lens of polish');
  // Quality polish is exempt: two different nodes at Q2 each add their half.
  const g3 = grid(1, 4);
  put(g3, 0, 0, 'box', { q: 2 }); put(g3, 0, 1, 'shader', { q: 2 });
  put(g3, 0, 2, 'light'); put(g3, 0, 3, 'comp');
  assert.strictEqual(V.evaluate(g3, {}).rowOut[0].polish, 1, 'Q2 box + Q2 shader = 0.5 + 0.5');
});

test('grades: B/A/S thresholds, new multipliers, soft polish cap', () => {
  assert.deepStrictEqual(V.CONFIG.gradePts, { B: 3, A: 6, S: 9 });
  assert.deepStrictEqual(V.CONFIG.gradeMult, { C: 0.85, B: 1.1, A: 1.5, S: 2.1 });
  const s = V.newStream();
  s.geo = true; s.tex = true; s.lit = true; s.final = true; s.step.fire = 4;
  const b = { kind: 'gig', hero: 'fire', minStars: 2, reqs: [], revealed: [] };
  let r = V.gradeShot(b, s, []);
  assert.strictEqual(r.stars, 4);
  assert.strictEqual(r.pts, 4);
  assert.strictEqual(r.grade, 'B');
  s.polish = 2; r = V.gradeShot(b, s, []);
  assert.strictEqual(r.pts, 6); assert.strictEqual(r.grade, 'A');
  // Raw polish 8 stays 8 for requirements/UI; grading uses 3 + (8−3)×0.5 = 5.5.
  s.polish = 8; r = V.gradeShot(b, s, []);
  assert.strictEqual(r.polish, 8);
  assert.strictEqual(r.gradePolish, 5.5);
  assert.strictEqual(r.pts, 9.5);
  assert.strictEqual(r.grade, 'S');
});

test('quality failure is a weaker take: chain step survives, support/light/comp keep working', () => {
  // Hero chain: failed Q2 Pyro Source still counts step 1; later Turbo is legal.
  const g = grid(1, 6);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc', { q: 2 }); put(g, 0, 2, 'pyro');
  put(g, 0, 3, 'turb'); put(g, 0, 4, 'light'); put(g, 0, 5, 'comp');
  const weak = V.evaluate(g, { fails: { '0,1': true } }).rowOut[0];
  assert.strictEqual(weak.step.fire, 3, 'chain did not break');
  assert.strictEqual(V.streamStars(weak, [], 'fire'), 2.5, '−0.5★');
  const strong = V.evaluate(g, {}).rowOut[0];
  assert.strictEqual(V.streamStars(strong, [], 'fire'), 3.5, 'Q2 success = +0.5★');
  // Surfacing: textures stay, no quality polish, −1.
  const gs = grid(1, 4);
  put(gs, 0, 0, 'box'); put(gs, 0, 1, 'shader', { q: 2 }); put(gs, 0, 2, 'light'); put(gs, 0, 3, 'comp');
  assert.strictEqual(V.evaluate(gs, {}).rowOut[0].polish, 0.5);
  const sf = V.evaluate(gs, { fails: { '0,1': true } }).rowOut[0];
  assert.ok(sf.tex, 'failed shader still textures');
  assert.strictEqual(sf.polish, 0);
  // Lighting: still lit/final, but 1 less polish than a clean Q2.
  const gl = grid(1, 4);
  put(gl, 0, 0, 'box'); put(gl, 0, 1, 'shader'); put(gl, 0, 2, 'threept', { q: 2 }); put(gl, 0, 3, 'comp');
  const lf = V.evaluate(gl, { fails: { '0,2': true } }).rowOut[0];
  assert.ok(lf.lit && lf.final);
  assert.strictEqual(lf.polish, 0);
  // Comp: final survives, grade loses its polish.
  const gc = grid(1, 4);
  put(gc, 0, 0, 'box'); put(gc, 0, 1, 'shader'); put(gc, 0, 2, 'light'); put(gc, 0, 3, 'grade', { q: 2 });
  const cf = V.evaluate(gc, { fails: { '0,3': true } }).rowOut[0];
  assert.ok(cf.final);
  assert.strictEqual(cf.polish, 0);
  // Functional traits survive a failed support roll: Toon stays stylized,
  // Lens still lays in grain.
  const gt = grid(1, 4);
  put(gt, 0, 0, 'box'); put(gt, 0, 1, 'toon', { q: 2 }); put(gt, 0, 2, 'light'); put(gt, 0, 3, 'comp');
  const tf = V.evaluate(gt, { fails: { '0,1': true } }).rowOut[0];
  assert.ok(tf.tex && tf.stylized, 'failed toon keeps stylized');
  const glens = grid(1, 4);
  put(glens, 0, 0, 'box'); put(glens, 0, 1, 'shader'); put(glens, 0, 2, 'light'); put(glens, 0, 3, 'lens', { q: 2 });
  const lf2 = V.evaluate(glens, { fails: { '0,3': true } }).rowOut[0];
  assert.ok(lf2.grain, 'failed Lens keeps grain');
  assert.strictEqual(lf2.polish, 0);
  // Source: a failed Q2 source still creates geometry; only the tier polish is lost.
  const gsrc = grid(1, 4);
  put(gsrc, 0, 0, 'box', { q: 2 }); put(gsrc, 0, 1, 'shader'); put(gsrc, 0, 2, 'light'); put(gsrc, 0, 3, 'comp');
  const srcF = V.evaluate(gsrc, { fails: { '0,0': true } }).rowOut[0];
  assert.ok(srcF.geo);
  assert.strictEqual(srcF.polish, 0);
  assert.strictEqual(V.evaluate(gsrc, {}).rowOut[0].polish, 0.5);
});

test('environment: Terrain must be Merged in from a side row; main-row Terrain does not count', () => {
  const main = grid(1, 4);
  put(main, 0, 0, 'terrain'); put(main, 0, 1, 'shader'); put(main, 0, 2, 'light'); put(main, 0, 3, 'comp');
  const s1 = V.evaluate(main, {}).rowOut[0];
  assert.ok(s1.env, 'terrain still makes environment geo');
  assert.strictEqual(V.REQS.env.test(s1), false, 'but as the main source it does not satisfy Environment');
  const side = grid(2, 5);
  put(side, 0, 0, 'box'); put(side, 0, 2, 'merge'); put(side, 0, 3, 'light'); put(side, 0, 4, 'comp');
  put(side, 1, 0, 'terrain');
  const s2 = V.evaluate(side, {}).rowOut[0];
  assert.strictEqual(V.REQS.env.test(s2), true, 'merged side Terrain satisfies Environment');
  // env + plate at once needs 3 rows (main in the middle, one side row each).
  const both = grid(3, 5);
  put(both, 0, 0, 'plate');
  put(both, 1, 0, 'box'); put(both, 1, 1, 'pyrosrc'); put(both, 1, 2, 'merge'); put(both, 1, 3, 'light'); put(both, 1, 4, 'plateint');
  put(both, 2, 0, 'terrain');
  const s3 = V.evaluate(both, {}).rowOut[1];
  assert.strictEqual(V.REQS.env.test(s3), true);
  assert.strictEqual(V.REQS.plate.test(s3), true);
  const noMerge = V.deckCapabilities([V.makeCard('terrain'), V.makeCard('light'), V.makeCard('comp')], { cols: 5, rows: 2 }, []);
  assert.strictEqual(noMerge.reqs.env, false, 'Terrain without Merge cannot satisfy env');
});

test('hardware: heavy FX RAM, Q2/Q3 RAM multipliers, GPU/RAM prices', () => {
  assert.ok(V.NODE_DEFS.upres.ram >= 16 && V.NODE_DEFS.upres.ram <= 20);
  assert.ok(V.NODE_DEFS.flip.ram >= 16 && V.NODE_DEFS.flip.ram <= 20);
  assert.ok(V.NODE_DEFS.mesher.ram >= 16 && V.NODE_DEFS.mesher.ram <= 20);
  const flip = V.makeCard('flip');
  assert.strictEqual(V.cardRam(flip), V.NODE_DEFS.flip.ram);
  assert.strictEqual(V.cardRam(Object.assign({}, flip, { q: 2 })), Math.round(V.NODE_DEFS.flip.ram * 1.5));
  assert.strictEqual(V.cardRam(Object.assign({}, flip, { q: 3 })), V.NODE_DEFS.flip.ram * 2);
  assert.deepStrictEqual(V.CONFIG.shop.gpu, [320, 480]);
  assert.strictEqual(V.CONFIG.shop.ram, 160);
});

test('solver tiers: quality raises detail growth and stays zero-risk', () => {
  const q1 = V.simParams(V.makeCard('pyro'), {});
  const q3 = V.simParams(V.makeCard('pyro', { q: 3 }), {});
  assert.ok(q3.detail > q1.detail, 'qDetail grows with the tier');
  assert.strictEqual(V.cardRisk(V.makeCard('pyro', { q: 3 })), 0, 'no quality risk for solvers');
});

test('relics: caffeine, hotkeys, usd, hda, farm, monitor, backup, wedge, pip', () => {
  const a = newJobGame('pyro'), b = newJobGame('pyro');
  b.relics.push('caffeine');
  a.chooseJob('gig', 0); b.chooseJob('gig', 0);
  assert.strictEqual(b.job.hoursTotal, a.job.hoursTotal + 5, 'caffeine +5h');
  assert.strictEqual(b.rentDue(), a.rentDue() + 25, 'caffeine +$25 rent');

  const c = newJobGame('pyro'), d = newJobGame('pyro');
  d.relics.push('backup');
  c.chooseJob('gig', 0); d.chooseJob('gig', 0);
  assert.strictEqual(d.job.hoursTotal, c.job.hoursTotal + 2, 'backup +2h');

  // Hotkeys: every Comp node +1 polish, stacks even for duplicates, no longer 0h.
  const gh = grid(1, 5);
  put(gh, 0, 0, 'box'); put(gh, 0, 1, 'shader'); put(gh, 0, 2, 'light'); put(gh, 0, 3, 'comp'); put(gh, 0, 4, 'comp');
  const plain = V.evaluate(gh, {}).rowOut[0].polish;
  assert.strictEqual(V.evaluate(gh, { relics: ['hotkeys'] }).rowOut[0].polish, plain + 2);
  assert.strictEqual(V.cardHours(V.makeCard('comp'), []), 1, 'Comp is no longer free');

  // USD: Merge 0h, merged stream +0.5★.
  const gu = grid(2, 5);
  put(gu, 0, 0, 'box'); put(gu, 0, 1, 'pyrosrc'); put(gu, 0, 2, 'merge'); put(gu, 0, 3, 'light'); put(gu, 0, 4, 'comp');
  put(gu, 1, 0, 'plate');
  assert.strictEqual(V.streamStars(V.evaluate(gu, {}).rowOut[0], [], 'fire'), 1);
  assert.strictEqual(V.streamStars(V.evaluate(gu, { relics: ['usd'] }).rowOut[0], ['usd'], 'fire'), 1.5);
  assert.strictEqual(V.cardHours(V.makeCard('merge'), ['usd']), 0);

  // HDA: priced at the relic floor and guaranteed in a post-week-3 shop.
  assert.strictEqual(V.CONFIG.shop.hda, V.CONFIG.shop.relicMin);
  const gh2 = new V.Game(9).start('pyro');
  gh2.week = 4;
  const sh = gh2.makeShop();
  const hda = sh.relics.find(r => r.id === 'hda');
  assert.ok(hda, 'HDA must be offered exactly once after week 3');
  assert.ok(hda.price >= V.CONFIG.shop.relicMin && hda.price <= V.CONFIG.shop.relicMax);

  // Farm: half price and +1h per rental.
  const gf = newJobGame('pyro');
  gf.chooseJob('gig', 0);
  gf.relics.push('farm');
  gf.job.hoursLeft = 0;
  const cash = gf.cash;
  assert.ok(gf.rentFarm().ok);
  assert.strictEqual(gf.cash, cash - Math.round(V.CONFIG.farmBasePrice / 2));
  assert.strictEqual(gf.job.hoursLeft, V.CONFIG.farmHours + 1);

  // Monitor: hidden-requirement jobs get +1 polish.
  const gm = grid(1, 4);
  put(gm, 0, 0, 'box'); put(gm, 0, 1, 'shader'); put(gm, 0, 2, 'light'); put(gm, 0, 3, 'comp');
  const hiddenBrief = { kind: 'gig', hero: 'fire', minStars: 0, reqs: [], hidden: { id: 'night' }, revealed: [] };
  const basePol = V.evaluate(gm, { brief: hiddenBrief }).rowOut[0].polish;
  assert.strictEqual(V.evaluate(gm, { brief: hiddenBrief, relics: ['monitor'] }).rowOut[0].polish, basePol + 1);

  // Wedge: steadier sims (and the predicted frame stays).
  const w0 = V.simParams(V.makeCard('pyro'), {});
  const w1 = V.simParams(V.makeCard('pyro'), { wedge: true });
  assert.ok(w1.inst < w0.inst);

  // Pip: +1 polish on every shot (the failure undo is in commitCook).
  assert.strictEqual(V.evaluate(gm, { relics: ['pip'] }).rowOut[0].polish, V.evaluate(gm, {}).rowOut[0].polish + 1);
});

test('full headless run of 12 weeks with a scripted player never throws', () => {
  for (const bg of Object.keys(V.BACKGROUNDS)) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = new V.Game(seed * 101).start(bg);
      let guard = 0;
      while (g.phase !== 'ending' && guard++ < 200) {
        if (g.phase === 'inbox') { g.inbox.forEach((m, i) => { if (m.choices && m.resolved == null) { if (g.resolveEvent(i, 0).ok === false) g.resolveEvent(i, m.choices.length - 1); } }); assert.ok(g.toBoard()); continue; }
        if (g.phase === 'board') {
          if (g.board.test && g.board.testGate.ok) g.chooseJob('test', 0, 'fire'); else g.chooseJob('gig', 0);
          continue;
        }
        if (g.phase === 'work') {
          const free = () => g.freeCards();
          const take = (t) => { const c = free().find(x => x.type === t); return c && c.uid; };
          const row = ['box', 'shader', 'pyrosrc', 'fracture', 'light', 'comp'].map(take).filter(Boolean).slice(0, g.hw.cols);
          row.forEach((u, i) => g.place(u, 0, i));
          const r = g.commitCook({});
          if (!r.ok) g.rentFarm(), g.commitCook({});
          if (g.job.last) g.deliver(); else { g.job.last = { stream: null, sigs: [], okKeys: {}, solver: {}, fails: {} }; g.deliver(); }
          continue;
        }
        if (g.phase === 'delivered') { if (g.lastDelivery.offer) g.acceptOffer(false); g.toWeekend(); continue; }
        if (g.phase === 'weekend') { g.buy('coffee'); g.nextWeek(); continue; }
      }
      assert.strictEqual(g.phase, 'ending', 'run should end (' + bg + ' seed ' + seed + ')');
      assert.ok(['evicted', 'freelance', 'dream', 'offer_kiln', 'offer_northlight'].includes(g.ending.id));
    }
  }
});

test('board: the gig for your best element is always deck-satisfiable', () => {
  for (const bg of Object.keys(V.BACKGROUNDS)) {
    for (let seed = 1; seed <= 4; seed++) {
      const g = new V.Game(seed * 977).start(bg);
      for (let w = 1; w <= 12; w++) {
        g.inbox.forEach((m, i) => {
          if (m.choices && m.resolved == null && !g.resolveEvent(i, 0).ok) g.resolveEvent(i, m.choices.length - 1);
        });
        assert.ok(g.toBoard(), 'toBoard ' + bg + ' seed ' + seed + ' week ' + w);
        const fav = g.favoriteElement();
        if (w > 1 && fav) {
          const gig = g.board.gigs.find(x => x.hero === fav);
          assert.ok(gig, 'favorite gig missing (' + bg + ' seed ' + seed + ' week ' + w + ')');
          const caps = V.deckCapabilities(g.cards, g.hw, g.relicSet());
          const allReqs = gig.reqs.concat(gig.hidden ? [gig.hidden] : []);
          const heroPolish = V.deckPolishFor(caps, fav, allReqs);
          for (const q of allReqs) {
            if (q.id === 'polish') assert.ok(q.n <= heroPolish, 'polish ' + q.n + ' > ' + heroPolish + ' (' + bg + ' w' + w + ')');
            else assert.ok(caps.reqs[q.id], 'unsatisfiable ' + q.id + ' (' + bg + ' seed ' + seed + ' week ' + w + ')');
          }
          const reachable = V.deckStarsFor(caps, fav, allReqs);
          assert.ok(gig.minStars <= reachable, 'star bar ' + gig.minStars + ' > ' + reachable + ' (' + bg + ' w' + w + ')');
          const budget = V.CONFIG.baseHours + (gig.hoursMod || 0);
          const step = Math.max(1, Math.floor(gig.minStars));
          assert.ok(V.deckMinHours(caps, fav, allReqs, step) <= budget, 'hours ' + V.deckMinHours(caps, fav, allReqs, step) + ' > ' + budget + ' (' + bg + ' w' + w + ')');
        }
        g.cash = 5000; g.job = null; g.lastDelivery = {};
        g.toWeekend();
        if (g.phase === 'weekend') g.nextWeek(); else break;
      }
    }
  }
});

test('shop: course count from config, one missing requirement enabler always on offer', () => {
  const enablers = ['moon', 'lens', 'toon', 'plateint', 'terrain'];
  assert.strictEqual(V.CONFIG.shop.courseCount, 4);
  for (const bg of Object.keys(V.BACKGROUNDS)) {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new V.Game(seed).start(bg);
      for (let w = 1; w <= 11; w++) {
        g.week = w;
        const sh = g.makeShop();
        assert.strictEqual(sh.courses.length, V.CONFIG.shop.courseCount);
        assert.strictEqual(new Set(sh.courses.map(c => c.type)).size, sh.courses.length, 'duplicate course');
        const owned = new Set(g.cards.map(c => c.type));
        const missing = enablers.filter(id => !owned.has(id));
        if (!missing.length) continue;
        const offered = sh.courses.filter(c => missing.includes(c.type));
        assert.ok(offered.length >= 1, 'no missing enabler in shop (' + bg + ' seed ' + seed + ' w' + w + ')');
        assert.ok(offered.some(c => c.unlocks && c.unlocks.length), 'missing enabler has no unlock label');
      }
    }
  }
});

test('Dust Pass adds smoke to any stream without adding hero stars', () => {
  assert.ok(V.NODE_DEFS.dustpass);
  const g = grid(1, 4);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'dustpass'); put(g, 0, 2, 'light'); put(g, 0, 3, 'comp');
  const ev = V.evaluate(g, {});
  const s = ev.rowOut[0];
  assert.ok(s.smoke);
  assert.strictEqual(V.streamStars(s, [], 'fire'), 0);
  const b = brief('fire', 0, ['lit', 'final', 'smoke']);
  assert.ok(V.evaluate(g, { brief: b }).best.pass);
});

test('Halcyon: reachable numbers and auteur tests do not move the polish bar', () => {
  const st = V.STUDIOS.halcyon;
  assert.strictEqual(st.minStars, 3.5);
  assert.strictEqual(st.hoursMod, 2);
  assert.strictEqual(st.reqs.find(q => q.id === 'polish').n, 2);
  const b = { kind: 'test', studio: 'halcyon', hero: 'fire', minStars: 3.5, reqs: JSON.parse(JSON.stringify(st.reqs)), revealed: [] };
  V.notesFor(b, { pass: true, missing: [], grade: 'S' }, 0, V.mulberry32(1));
  assert.strictEqual(b.reqs.find(q => q.id === 'polish').n, 2, 'auteur must not raise polish on tests');
  // a gig auteur still raises it once
  const b2 = { kind: 'gig', client: 'juno', hero: 'fire', minStars: 2, reqs: [{ id: 'polish', n: 2 }], revealed: [] };
  V.notesFor(b2, { pass: true, missing: [], grade: 'B' }, 0, V.mulberry32(1));
  assert.strictEqual(b2.reqs.find(q => q.id === 'polish').n, 3);
});

test('gate: the current test shot counts towards the reel gate; distinct still needs 2 elements', () => {
  const gate = V.reelGate('halcyon');
  const reel = [{ stars: 3.5, el: 'fire' }, { stars: 4, el: 'fire' }, { stars: 3, el: 'fire' }];
  assert.strictEqual(V.checkGate(gate, reel).ok, false, 'one element only');
  assert.strictEqual(V.checkGate(gate, reel, { testShot: { stars: 3.5, heroChoices: true } }).ok, true);
  const reelOne = [{ stars: 4, el: 'fire' }];
  assert.strictEqual(V.checkGate(gate, reelOne, { testShot: { stars: 3.5, heroChoices: true } }).ok, false, 'count still short');
});

test('week 12 charges rent and can evict', () => {
  const poor = new V.Game(1).start('pyro');
  poor.week = 12; poor.phase = 'delivered'; poor.lastDelivery = {}; poor.cash = 0;
  poor.toWeekend();
  assert.strictEqual(poor.phase, 'ending');
  assert.strictEqual(poor.ending.id, 'evicted');
  const rich = new V.Game(1).start('pyro');
  rich.week = 12; rich.phase = 'delivered'; rich.lastDelivery = {}; rich.cash = 5000;
  const rent = rich.rentDue();
  rich.toWeekend();
  assert.strictEqual(rich.ending.id, 'freelance');
  assert.strictEqual(rich.cash, 5000 - rent);
});

test('re-cook: unchanged stable solvers are cached; diverged solvers pay hours again', () => {
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'pyrosrc'), 0, 1);
  g.place(uidOf(g, 'pyro'), 0, 2); g.place(uidOf(g, 'light'), 0, 3);
  const first = g.commitCook({ '0,2': { detail: 65, diverged: false, f: 35 } });
  assert.strictEqual(first.cost, 5);
  assert.strictEqual(g.preview().cost, 0, 'unchanged network is fully cached');
  assert.strictEqual(g.prepareCook().sims.length, 0, 'stable solver must not re-roll');
  const second = g.commitCook({});
  assert.strictEqual(second.cost, 0);
  assert.strictEqual(g.job.last.solver['0,2'].detail, 65, 'cached solver result is unchanged');

  const g2 = newJobGame('pyro');
  g2.chooseJob('gig', 0);
  g2.place(uidOf(g2, 'box'), 0, 0); g2.place(uidOf(g2, 'pyrosrc'), 0, 1);
  g2.place(uidOf(g2, 'pyro'), 0, 2); g2.place(uidOf(g2, 'light'), 0, 3);
  g2.commitCook({ '0,2': { detail: 20, diverged: true, f: 12 } });
  const hoursBefore = g2.job.hoursLeft;
  assert.ok(g2.preview().cost > 0, 'diverged solver must cost hours again');
  assert.strictEqual(g2.prepareCook().sims.length, 1, 'diverged solver re-sims');
  const rerun = g2.commitCook({});
  assert.ok(rerun.cost >= V.cardHours(g2.cards.find(c => c.type === 'pyro')), 're-cook charges solver hours');
  assert.strictEqual(g2.job.hoursLeft, hoursBefore - rerun.cost);
});

test('disk failure event hurts hours and a quality tier, never deletes cards', () => {
  const g = new V.Game(5).start('pyro');
  const basics = ['box', 'light', 'comp', 'merge', 'plate', 'shader'];
  g.cards.forEach(c => { if (!basics.includes(c.type)) c.q = 2; });
  const before = g.cards.length;
  const ev = S.EVENTS.find(e => e.id === 'drive');
  const msg = ev.make(g);
  msg.choices[0].effect(g);
  assert.strictEqual(g.cards.length, before, 'no card may be deleted');
  assert.strictEqual(g.flags.hoursPenalty, -4);
  assert.ok(g.cards.some(c => !basics.includes(c.type) && (c.q || 1) === 1), 'one non-basic card dropped to Q1');
});

test('sim: spikes get more likely with frame; detail growth decays late', () => {
  assert.ok(V.simSpikeChance(1) < V.simSpikeChance(20));
  assert.ok(V.simSpikeChance(20) < V.simSpikeChance(40));
  const p = V.simParams(V.makeCard('pyro'), {});
  const rng = () => 0.5; // deterministic, no spike at these frames
  const early = V.simInit(p, 1); V.simStep(early, rng);
  const late = V.simInit(p, 1); late.f = 40; V.simStep(late, rng);
  assert.ok(late.detail < early.detail, 'frame 41 must add less detail than frame 1');
});

test('sim bands: three levels, and each sim shifts the edges', () => {
  assert.strictEqual(V.simBand(10, 0), 'steady');
  assert.strictEqual(V.simBand(50, 0), 'warn');
  assert.strictEqual(V.simBand(80, 0), 'danger');
  assert.strictEqual(V.simBand(75, 12), 'warn', 'late danger edge');
  assert.strictEqual(V.simBand(60, -12), 'danger', 'early danger edge');
  const p = V.simParams(V.makeCard('pyro'), {});
  const shifts = new Set();
  for (let s = 0; s < 40; s++) shifts.add(V.simInit(p, s).bandShift);
  assert.ok(shifts.size > 5, 'band shift varies per sim');
});

test('notes: easy client rounds up the invoice; pincher offers a real choice', () => {
  const rng = V.mulberry32(1);
  const b = brief('fire', 1, ['lit']);
  b.kind = 'gig'; b.client = 'rumble';
  const n = V.notesFor(b, { pass: true, missing: [], grade: 'S' }, 0, rng);
  assert.strictEqual(n.persona, 'easy');
  assert.strictEqual(b.payBoost, 1.2);
  assert.ok(n.lines.length > 0);

  // …and the boost really lands in the invoice.
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.job.brief = { kind: 'gig', client: 'rumble', hero: 'fire', minStars: 1, reqs: [{ id: 'lit' }], revealed: [], pay: 1000, nda: false };
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'pyrosrc'), 0, 1); g.place(uidOf(g, 'light'), 0, 2);
  assert.ok(g.commitCook({}).ok);
  const gr = V.gradeShot(g.job.brief, g.job.last.stream, g.relicSet());
  assert.ok(gr.pass);
  assert.strictEqual(g.job.brief.payBoost, 1.2);
  const expected = Math.round(1000 * V.CONFIG.gradeMult[gr.grade] * 1.2 / 10) * 10;
  assert.strictEqual(g.deliver().pay, expected);

  const b2 = brief('fire', 1, ['lit']);
  b2.kind = 'gig'; b2.client = 'oldpine';
  const n2 = V.notesFor(b2, { pass: true, missing: [], grade: 'B' }, 0, rng);
  assert.strictEqual(n2.persona, 'pincher');
  assert.ok(n2.choice && n2.choice.options.length === 2);
  assert.strictEqual(b2.twisted, true);
});

test('pincher: choosing the hours cut applies it and blocks delivery until answered', () => {
  const g = newJobGame('pyro');
  g.chooseJob('gig', 0);
  g.job.brief = { kind: 'gig', client: 'oldpine', hero: 'fire', minStars: 1, reqs: [{ id: 'lit' }], revealed: [], pay: 900 };
  g.place(uidOf(g, 'box'), 0, 0); g.place(uidOf(g, 'light'), 0, 1);
  assert.ok(g.commitCook({}).ok);
  assert.ok(g.job.pendingNote, 'pincher must leave a pending choice');
  assert.strictEqual(g.canDeliver(), false, 'delivery waits for the answer');
  const before = g.job.hoursLeft;
  assert.ok(g.resolveNote('hours').ok);
  assert.strictEqual(g.job.hoursLeft, Math.round(before * 0.8));
  assert.strictEqual(g.job.pendingNote, null);
  assert.strictEqual(g.canDeliver(), true);
  // the pay branch is the other option
  g.job.brief = { kind: 'gig', client: 'oldpine', hero: 'fire', minStars: 1, reqs: [{ id: 'lit' }], revealed: [], pay: 900 };
  g.job.pendingNote = { kind: 'pincher', defaultKey: 'pay', options: [{ key: 'hours' }, { key: 'pay' }] };
  g.resolveNote('pay');
  assert.strictEqual(g.job.brief.payMulNote, 0.8);
  // headless callers that ignore the choice get the safe default (keep hours)
  g.job.brief = { kind: 'gig', client: 'oldpine', hero: 'fire', minStars: 1, reqs: [{ id: 'lit' }], revealed: [], pay: 900 };
  g.job.pendingNote = { kind: 'pincher', defaultKey: 'pay', options: [{ key: 'hours' }, { key: 'pay' }] };
  g.prepareCook();
  assert.strictEqual(g.job.pendingNote, null, 'cooking falls back to the default');
  assert.strictEqual(g.job.brief.payMulNote, 0.8);
});

test('flipper: payMul 1.6 and the new hero is the deck\'s second-strongest element', () => {
  assert.strictEqual(V.CLIENTS.fizzco.payMul, 1.6);
  const cards = ['box', 'pyrosrc', 'pyro', 'turb', 'flipsrc', 'flip', 'light', 'comp', 'merge'].map(id => V.makeCard(id));
  const caps = V.deckCapabilities(cards, { cols: 8, rows: 3, ram: 64 }, []);
  assert.ok(caps.maxStars.fire > caps.maxStars.water, 'fire is the strongest chain');
  const gig = { kind: 'gig', client: 'fizzco', hero: 'fire', minStars: 2, reqs: [{ id: 'lit' }], revealed: [] };
  assert.strictEqual(V.flipTargetFor(caps, gig, V.mulberry32(5)), 'water');
  // the note uses that precomputed target instead of rolling a random element
  Object.assign(gig, { flipTo: 'water' });
  V.notesFor(gig, { pass: true, missing: [], grade: 'B' }, 0, V.mulberry32(5));
  assert.strictEqual(gig.hero, 'water');
});

test('secret: hidden requirements are drawn only from what the deck can satisfy', () => {
  const cards = ['box', 'shader', 'light', 'comp', 'merge', 'terrain', 'toon', 'lens'].map(id => V.makeCard(id));
  const caps = V.deckCapabilities(cards, { cols: 8, rows: 4, ram: 64 }, []);
  for (let seed = 1; seed <= 30; seed++) {
    const gig = V.genGig(V.mulberry32(seed), 5, 'vale', 'pyro', caps);
    assert.ok(gig.hidden, 'secret gig has a hidden requirement');
    assert.ok(caps.reqs[gig.hidden.id], 'hidden ' + gig.hidden.id + ' must be satisfiable (seed ' + seed + ')');
  }
});

test('i18n: en/zh UI tables have identical, non-empty keys', () => {
  const en = Object.keys(V.I18N.en).sort(), zh = Object.keys(V.I18N.zh).sort();
  assert.deepStrictEqual(en, zh);
  for (const k of en) { assert.ok(V.I18N.en[k] !== '', 'empty en ' + k); assert.ok(V.I18N.zh[k] !== '', 'empty zh ' + k); }
});

test('i18n: every node, relic, client, element, requirement is bilingual', () => {
  const both = (v, w) => { assert.ok(v && v.en && v.zh, 'missing translation: ' + w); };
  for (const id of V.NODE_IDS) { both(V.NODE_DEFS[id].name, id); both(V.NODE_DEFS[id].desc, id); }
  for (const id in V.RELICS) { both(V.RELICS[id].name, id); both(V.RELICS[id].desc, id); }
  for (const id in V.CLIENTS) { both(V.CLIENTS[id].company, id); both(V.CLIENTS[id].hello, id); }
  for (const id in V.ELEMENTS) both(V.ELEMENTS[id].name, id);
  for (const id in V.REQS) { both(V.REQS[id].name, id); both(V.REQS[id].hint, id); }
  for (const id in V.DEPTS) both(V.DEPTS[id].name, id);
  assert.ok(V.t('ui.cook', null, 'zh') !== 'ui.cook');
});

test('every error key the engine can return exists in the UI tables', () => {
  const keys = ['err.noInput', 'err.deadInput', 'err.needGeo', 'err.needStep', 'err.needOrganic', 'err.needFire', 'err.needLit', 'err.needPlate', 'err.oom', 'err.hours', 'err.noDailies', 'err.noteChoice', 'err.empty', 'err.cash', 'err.farmMax', 'err.gate', 'err.hdaOrder',
    'fail.model', 'fail.surf', 'fail.char', 'fail.fx', 'fail.light', 'fail.comp', 'gate.count', 'gate.distinct', 'gate.top'];
  for (const k of keys) assert.ok(V.I18N.en[k], 'missing ' + k);
});

console.log('\n' + passed + ' tests');
console.log('ALL TESTS PASSED');
