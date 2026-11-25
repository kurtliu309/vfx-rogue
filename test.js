'use strict';
const assert = require('assert');
const V = require('./engine.js');

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
  // stars 3, over 1 → 2 pts + polish (threept 1 + grade 1) = 4 → A
  assert.strictEqual(ev.best.stars, 3);
  assert.strictEqual(ev.best.grade, 'A');
  const ev2 = V.evaluate(g, { solverResults: { '0,3': { bonus: 1 } }, brief: brief('fire', 1, ['lit']) });
  assert.ok(!ev2.best.pass);
  assert.ok(ev2.best.missing.includes('hero'));
});

test('quality tiers add hours/RAM/risk; hero tiers add +0.5★', () => {
  const c = V.makeCard('turb', { q: 3 });
  assert.strictEqual(V.cardHours(c), 3);
  assert.strictEqual(V.cardRam(c), 8);
  assert.strictEqual(V.cardRisk(c), 0.3);
  const g = grid(1, 6);
  put(g, 0, 0, 'box'); put(g, 0, 1, 'pyrosrc', { q: 3 }); put(g, 0, 2, 'light'); put(g, 0, 3, 'comp');
  assert.strictEqual(V.streamStars(V.evaluate(g, {}).rowOut[0], [], 'fire'), 2);
  const fails = { '0,1': true };
  assert.strictEqual(V.evaluate(g, { fails }).rowOut[0].step.fire, 0);
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
  const keys = ['err.noInput', 'err.deadInput', 'err.needGeo', 'err.needStep', 'err.needOrganic', 'err.needFire', 'err.needLit', 'err.needPlate', 'err.oom', 'err.hours', 'err.noDailies', 'err.empty', 'err.cash', 'err.farmMax', 'err.gate', 'err.hdaOrder',
    'fail.model', 'fail.surf', 'fail.char', 'fail.fx', 'fail.light', 'fail.comp', 'gate.count', 'gate.distinct', 'gate.top'];
  for (const k of keys) assert.ok(V.I18N.en[k], 'missing ' + k);
});

console.log('\n' + passed + ' tests');
console.log('ALL TESTS PASSED');
