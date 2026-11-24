'use strict';

const assert = require('assert');
const VFX = require('./engine.js');

const approx = (actual, expected, eps, msg) => {
  const e = eps == null ? 1e-9 : eps;
  assert.ok(Math.abs(actual - expected) <= e, (msg || '数值不符') + `：期望 ${expected}，实际 ${actual}`);
};

const blank = () => VFX.emptyGrid();
const put = (grid, row, col, type, opts) => {
  grid[row][col] = VFX.makeCard(type, opts || {});
  return grid[row][col];
};
const baseOpts = (extra) => Object.assign({
  targetOutput: 'final',
  targetScore: 0,
  budget: 30,
  relics: []
}, extra || {});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
    throw err;
  }
}

console.log('节点肉鸽 · 引擎测试');

test('直线链计分：Box → Pyro → Key Light → Grade', () => {
  const g = blank();
  put(g, 0, 2, 'box');
  put(g, 0, 3, 'pyro');
  put(g, 0, 4, 'keylight');
  put(g, 0, 5, 'grade');

  const r = VFX.evaluate(g, baseOpts({ targetScore: 50 }));
  approx(r.cells[0][2].value, 10);
  approx(r.cells[0][3].value, 25);
  approx(r.cells[0][4].value, 37.5);
  approx(r.cells[0][5].value, 54.375);
  approx(r.totalScore, 54.375);
  assert.strictEqual(r.displayTotal, 54);
  assert.strictEqual(r.rows[0].outputType, 'final');
  assert.strictEqual(r.rows[0].targetMatch, true);
  assert.strictEqual(r.hours, 5);
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.overBudget, false);
});

test('端口不匹配不连：geo 直接进 Grade', () => {
  const g = blank();
  put(g, 0, 4, 'box');
  put(g, 0, 5, 'grade');

  const r = VFX.evaluate(g, baseOpts());
  assert.strictEqual(r.cells[0][5].active, false);
  assert.strictEqual(r.cells[0][5].supplied, false);
  assert.strictEqual(r.rows[0].score, 0);
  assert.strictEqual(r.displayTotal, 0);
  const c = r.connections.find(x => x.to.row === 0 && x.to.col === 5);
  assert.ok(c, '应记录这条断开的边');
  assert.strictEqual(c.mismatch, true);
  assert.strictEqual(c.connected, false);
  assert.strictEqual(c.fromType, 'geo');
});

test('USD 遗物：每关第一处不匹配可连', () => {
  const g = blank();
  put(g, 0, 4, 'box');
  put(g, 0, 5, 'grade');

  const r = VFX.evaluate(g, baseOpts({ relics: ['usd'] }));
  assert.strictEqual(r.usdUsed, true);
  assert.strictEqual(r.cells[0][5].supplied, true);
  approx(r.cells[0][5].value, 11.5); // Grade：10 × (1 + 0.15×1)
});

test('Lighting 光环：同列相邻非 Lighting 节点 ×1.3', () => {
  const g = blank();
  put(g, 0, 1, 'box');          // 源，放在光环旁边
  put(g, 1, 0, 'box');
  put(g, 1, 1, 'keylight');

  const r = VFX.evaluate(g, baseOpts());
  approx(r.cells[0][1].value, 13, 1e-9, '相邻 Box 应被光环放大');
  approx(r.cells[0][1].auraMultiplier, 1.3);
  approx(r.cells[1][1].value, 15, 1e-9, '光环不作用于 Lighting 自己');
  approx(r.cells[1][1].auraMultiplier, 1);
});

test('Lighting 羁绊：三个有效 Lighting 时光环变 ×1.5', () => {
  const g = blank();
  put(g, 0, 1, 'box');       // 光环目标（源）
  put(g, 1, 0, 'box'); put(g, 1, 1, 'keylight');
  put(g, 2, 0, 'box'); put(g, 2, 1, 'keylight');
  put(g, 0, 2, 'keylight');  // 第三个有效 Lighting：接 row0 col1 的 Box

  const r = VFX.evaluate(g, baseOpts());
  assert.strictEqual(r.bonds.model, 3);
  assert.strictEqual(r.bonds.lighting, 3);
  assert.strictEqual(r.bondActive.lighting, true);
  // Model 羁绊先把 Box 变成 20，再吃 Lighting 羁绊后的 ×1.5 光环
  approx(r.cells[0][1].value, 30, 1e-9, 'Lighting 羁绊后光环 ×1.5');
  approx(r.cells[0][1].auraMultiplier, 1.5);
  approx(r.cells[1][1].auraMultiplier, 1, 1e-9, 'Lighting 不给自己上光环');
});

test('Model 纵向堆叠：Kitbash 同列每有一个其他 Model +12', () => {
  const g = blank();
  put(g, 0, 0, 'box');
  put(g, 1, 0, 'kitbash');
  const r = VFX.evaluate(g, baseOpts());
  approx(r.cells[0][0].value, 10);
  approx(r.cells[1][0].value, 20);
  assert.strictEqual(r.bonds.model, 2);
  assert.strictEqual(r.bondActive.model, false);

  const h = blank();
  put(h, 0, 0, 'box');
  put(h, 1, 0, 'kitbash');
  put(h, 2, 0, 'box');
  const r2 = VFX.evaluate(h, baseOpts());
  assert.strictEqual(r2.bondActive.model, true);
  approx(r2.cells[0][0].value, 20, 1e-9, 'Model 羁绊 +10');
  approx(r2.cells[1][0].value, 42, 1e-9, '(8+12+12)+10');
});

test('substep 爆炸：可注入随机数、爆炸断流', () => {
  const g = blank();
  put(g, 0, 4, 'box');
  put(g, 0, 5, 'pyro', { substep: 4 });

  const preview = VFX.evaluate(g, baseOpts({ targetOutput: 'sim' }));
  approx(preview.cells[0][5].value, 68.6);
  assert.strictEqual(preview.cells[0][5].explosionChance, 60);
  assert.strictEqual(preview.explosionCount, 0);
  assert.strictEqual(preview.displayTotal, 69);

  const cooked = VFX.evaluate(g, baseOpts({
    targetOutput: 'sim', roll: true, rng: () => 0
  }));
  assert.strictEqual(cooked.cells[0][5].exploded, true);
  assert.strictEqual(cooked.cells[0][5].supplied, false);
  assert.strictEqual(cooked.cells[0][5].value, 0);
  assert.strictEqual(cooked.displayTotal, 0);
  assert.strictEqual(cooked.explosionCount, 1);
  approx(cooked.explosions[0].preValue, 68.6);

  const safe = VFX.evaluate(g, baseOpts({
    targetOutput: 'sim', roll: true, rng: () => 0.99
  }));
  assert.strictEqual(safe.cells[0][5].exploded, false);
  assert.strictEqual(safe.displayTotal, 69);

  const cache = VFX.evaluate(g, baseOpts({
    targetOutput: 'sim', roll: true, rng: () => 0, relics: ['cache']
  }));
  assert.strictEqual(cache.cells[0][5].exploded, true);
  assert.strictEqual(cache.cells[0][5].supplied, true);
  approx(cache.cells[0][5].value, 34.3);
});

test('Roto 救场：上游爆炸后取爆炸前值的 60% 再 +20', () => {
  const g = blank();
  put(g, 0, 2, 'box');
  put(g, 0, 3, 'pyro', { substep: 2 }); // 35 → substep2 35？基础 25×1.4=35
  put(g, 0, 4, 'keylight');
  put(g, 0, 5, 'roto');

  const boom = VFX.evaluate(g, baseOpts({ roll: true, rng: () => 0 }));
  assert.strictEqual(boom.explosionCount, 1);
  assert.strictEqual(boom.cells[0][3].exploded, true);
  assert.strictEqual(boom.cells[0][3].supplied, false);
  assert.strictEqual(boom.cells[0][4].supplied, false);
  assert.strictEqual(boom.cells[0][5].rescued, true);
  approx(boom.cells[0][5].inputValue, 21);
  approx(boom.cells[0][5].value, 41);
  assert.strictEqual(boom.displayTotal, 41);

  const normal = VFX.evaluate(g, baseOpts({ roll: true, rng: () => 0.99 }));
  approx(normal.cells[0][3].value, 35);
  approx(normal.cells[0][4].value, 52.5);
  approx(normal.cells[0][5].value, 72.5);
  assert.strictEqual(normal.cells[0][5].rescued, false);
});

test('Merge 汇合：多输入相加并乘部门数', () => {
  const g = blank();
  put(g, 0, 4, 'box');                       // 上行源 → Merge 左上
  put(g, 1, 3, 'box');
  put(g, 1, 4, 'pyro');                      // 35? 10×2.5=25 → Merge 左侧
  put(g, 1, 5, 'merge');

  const r = VFX.evaluate(g, baseOpts({ targetOutput: 'sim' }));
  assert.strictEqual(r.connections.filter(c => c.mode === 'merge').length, 2);
  approx(r.cells[1][5].inputValue, 35);
  approx(r.cells[1][5].value, 52.5); // (25 + 10) × (1 + 0.25×2) = 52.5
  assert.strictEqual(r.cells[1][5].outputType, 'sim');
  assert.strictEqual(r.rows[1].targetMatch, true);
  approx(r.displayTotal, 53);
});

test('输出类型不符得 0', () => {
  const g = blank();
  put(g, 0, 2, 'box');
  put(g, 0, 3, 'pyro');
  put(g, 0, 4, 'keylight');
  put(g, 0, 5, 'grade');

  const r = VFX.evaluate(g, baseOpts({ targetOutput: 'sim' }));
  assert.strictEqual(r.rows[0].outputType, 'final');
  approx(r.rows[0].value, 54.375);
  assert.strictEqual(r.rows[0].targetMatch, false);
  assert.strictEqual(r.rows[0].score, 0);
  assert.strictEqual(r.displayTotal, 0);
});

test('预算超限：evaluate 标记且禁止 Cook（状态不被消耗）', () => {
  const g = blank();
  put(g, 0, 2, 'box');
  put(g, 0, 3, 'pyro');
  put(g, 0, 4, 'keylight');
  put(g, 0, 5, 'grade');

  const r = VFX.evaluate(g, baseOpts({ budget: 2, targetScore: 100 }));
  assert.strictEqual(r.hours, 5);
  assert.strictEqual(r.overBudget, true);
  assert.strictEqual(r.canCook, false);
  assert.strictEqual(r.success, false);

  const game = new VFX.Game({ seed: 20261124 });
  game.levels[0].baseBudget = 0;
  game.startLevel();
  const card = game.state.hand[0];
  const placed = game.placeCard(card.uid, 0, 0);
  assert.strictEqual(placed.ok, true);
  const before = game.state.cooksLeft;
  const cooked = game.cook();
  assert.strictEqual(cooked.ok, false);
  assert.strictEqual(cooked.reason, 'err.overBudget');
  assert.strictEqual(game.state.cooksLeft, before);
  assert.strictEqual(game.state.attempts, 0);
});

test('部门羁绊：Comp ≥3 时 Comp 节点耗时归零', () => {
  const g = blank();
  put(g, 0, 2, 'box'); put(g, 0, 3, 'pyro'); put(g, 0, 4, 'keylight'); put(g, 0, 5, 'grade');
  put(g, 1, 2, 'box'); put(g, 1, 3, 'pyro'); put(g, 1, 4, 'keylight'); put(g, 1, 5, 'roto');
  put(g, 2, 2, 'box'); put(g, 2, 3, 'pyro'); put(g, 2, 4, 'keylight'); put(g, 2, 5, 'keygreen');

  const r = VFX.evaluate(g, baseOpts());
  assert.strictEqual(r.bonds.comp, 3);
  assert.strictEqual(r.bondActive.comp, true);
  assert.strictEqual(r.cells[0][5].hours, 0);
  assert.strictEqual(r.cells[1][5].hours, 0);
  assert.strictEqual(r.cells[2][5].hours, 0);
  // Grade/Roto/Key 绿幕都归零，只剩三个源 + 三个 Pyro + 三个 Key Light = 4×3 = 12h
  assert.strictEqual(r.hours, 12);
});

test('只招专才：非主导部门成为直通 ×1 / 0h', () => {
  const g = blank();
  // FX 数量最多（2 FX + 1 Lighting + 1 Comp）
  put(g, 0, 2, 'box');
  put(g, 0, 3, 'pyro');
  put(g, 0, 4, 'keylight');
  put(g, 0, 5, 'grade');
  put(g, 1, 2, 'box');
  put(g, 1, 3, 'pyro');

  const r = VFX.evaluate(g, baseOpts({ ruleId: 'specialist' }));
  assert.strictEqual(r.specialistDept, 'fx');
  assert.strictEqual(r.cells[0][4].passThrough, true, 'Lighting 直通');
  assert.strictEqual(r.cells[0][5].passThrough, true, 'Comp 直通');
  assert.strictEqual(r.cells[0][4].hours, 0);
  assert.strictEqual(r.cells[0][5].hours, 0);
  // 直通：端口类型保留，数值不经过节点倍率（Key Light 本应 ×1.5，Grade 本应 ×1.45）
  assert.strictEqual(r.cells[0][4].outputType, 'render');
  assert.strictEqual(r.cells[0][5].outputType, 'final');
  approx(r.cells[0][4].value, 25);
  approx(r.cells[0][5].value, 25);
  assert.strictEqual(r.rows[0].targetMatch, true);
  approx(r.displayTotal, 25);
});

test('要全面的人：部门数不足的行得分减半', () => {
  const g2 = blank();
  put(g2, 0, 4, 'box');
  put(g2, 0, 5, 'box'); // 另一个源，类型 geo，链里只有 Model
  const r = VFX.evaluate(g2, baseOpts({ targetOutput: 'geo', ruleId: 'generalist' }));
  assert.strictEqual(r.rows[0].targetMatch, true);
  assert.strictEqual(r.rows[0].generalistHalved, true);
  approx(r.rows[0].score, 5);
});

test('关卡生成：18 关、三个月一轮、Boss 目标 ×1.3', () => {
  const rng = VFX.createRng(42);
  const levels = VFX.generateLevels(rng);
  assert.strictEqual(levels.length, 18);
  assert.deepStrictEqual(levels.slice(0, 3).map(l => l.tier), ['side', 'mid', 'boss']);
  for (let i = 0; i < levels.length; i += 3) {
    assert.strictEqual(levels[i].tier, 'side');
    assert.strictEqual(levels[i + 1].tier, 'mid');
    assert.strictEqual(levels[i + 2].tier, 'boss');
    assert.ok(levels[i + 1].relicReward);
  }
  assert.ok(levels[2].targetScore > levels[1].targetScore);
});

test('Boss 目标分：基础曲线乘以 1.3', () => {
  const levels = VFX.generateLevels(VFX.createRng(99));
  for (const idx of [2, 5, 8, 11, 14, 17]) {
    const base = Math.round(VFX.CONFIG.targetBase * Math.pow(VFX.CONFIG.targetGrowth, idx));
    assert.strictEqual(levels[idx].targetScore, Math.round(base * VFX.CONFIG.bossTargetMultiplier));
  }
});

test('咖啡因依赖：预算 +3h，下月房租 +$200', () => {
  const game = new VFX.Game({ seed: 12345 });
  game.state.relics.push('caffeine');
  assert.strictEqual(game.currentRent(), VFX.CONFIG.rent + VFX.CONFIG.caffeineExtraRent);
  const preview = game.getPreview();
  const rulePenalty = game.level.ruleId === 'renderfarm' ? VFX.CONFIG.renderFarmBudgetPenalty : 0;
  assert.strictEqual(preview.budget, game.level.baseBudget - rulePenalty + VFX.CONFIG.caffeineBudgetBonus);
});

test('局内经济：开局扣房租，Cook/离开商店进入下一关', () => {
  const game = new VFX.Game({ seed: 7 });
  const s = game.state;
  assert.strictEqual(s.money, VFX.CONFIG.startingMoney - VFX.CONFIG.rent);
  assert.strictEqual(s.month, 1);
  assert.strictEqual(game.level.tier, 'side');
  assert.strictEqual(s.hand.length, Math.min(12, VFX.CONFIG.handSize));
  assert.strictEqual(s.cooksLeft, 3);
  // 任意摆一张牌并结束三次未达标的 Cook
  game.levels[0].targetScore = 999999;
  game.startLevel();
  const c = game.state.hand[0];
  assert.strictEqual(game.placeCard(c.uid, 0, 0).ok, true);
  let out = game.cook();
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.ended, false);
  out = game.cook();
  out = game.cook();
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.ended, true);
  assert.strictEqual(game.state.phase, 'levelEnd');
  const cont = game.continueAfterLevel();
  assert.strictEqual(cont.phase, 'shop');
  assert.ok(game.state.shop);
  const beforeLevel = game.state.levelIndex;
  const left = game.leaveShop();
  assert.strictEqual(left.ok, true);
  assert.strictEqual(game.state.levelIndex, beforeLevel + 1);
  assert.strictEqual(game.state.phase, 'playing');
});

console.log('\n国际化 / i18n');

test('i18n：en 与 zh 两张表的 key 完全一致且非空', () => {
  const enKeys = Object.keys(VFX.I18N.en).sort();
  const zhKeys = Object.keys(VFX.I18N.zh).sort();
  assert.deepStrictEqual(zhKeys, enKeys, 'en / zh 的 key 集合不一致');
  enKeys.forEach((key) => {
    assert.strictEqual(typeof VFX.I18N.en[key], 'string', key + ' 的 en 不是字符串');
    assert.strictEqual(typeof VFX.I18N.zh[key], 'string', key + ' 的 zh 不是字符串');
    assert.ok(VFX.I18N.en[key].trim().length > 0, key + ' 的 en 为空');
    assert.ok(VFX.I18N.zh[key].trim().length > 0, key + ' 的 zh 为空');
  });
});

test('i18n：每个节点 / 遗物 / 规则都有双语名称和说明', () => {
  const checkText = (kind, id, field, value) => {
    assert.ok(value && typeof value === 'object', `${kind}.${id}.${field} 不是双语对象`);
    assert.ok(typeof value.en === 'string' && value.en.trim(), `${kind}.${id}.${field}.en 为空`);
    assert.ok(typeof value.zh === 'string' && value.zh.trim(), `${kind}.${id}.${field}.zh 为空`);
  };
  Object.keys(VFX.NODE_DEFS).forEach((id) => {
    checkText('node', id, 'name', VFX.NODE_DEFS[id].name);
    checkText('node', id, 'desc', VFX.NODE_DEFS[id].desc);
  });
  Object.keys(VFX.RELICS).forEach((id) => {
    checkText('relic', id, 'name', VFX.RELICS[id].name);
    checkText('relic', id, 'desc', VFX.RELICS[id].desc);
  });
  Object.keys(VFX.RULES).forEach((id) => {
    checkText('rule', id, 'name', VFX.RULES[id].name);
    checkText('rule', id, 'desc', VFX.RULES[id].desc);
  });
});

test('i18n：部门、端口、公司名也都有两种语言', () => {
  Object.keys(VFX.DEPARTMENTS).forEach((id) => {
    const name = VFX.DEPARTMENTS[id].name;
    assert.ok(name && name.en && name.zh, 'department ' + id);
  });
  Object.keys(VFX.PORTS).forEach((id) => {
    const name = VFX.PORTS[id].name;
    assert.ok(name && name.en && name.zh, 'port ' + id);
  });
  Object.keys(VFX.COMPANY_NAMES).forEach((tier) => {
    VFX.COMPANY_NAMES[tier].forEach((name, i) => {
      assert.ok(name && name.en && name.zh, `company ${tier}[${i}]`);
    });
  });
});

test('i18n：t() 默认英文，L() 按语言取数据文字', () => {
  assert.strictEqual(VFX.t('top.money', 'en'), 'CASH');
  assert.strictEqual(VFX.t('top.money', 'zh'), '存款');
  assert.strictEqual(VFX.t('top.money'), 'CASH');
  assert.strictEqual(VFX.L(VFX.NODE_DEFS.box.name, 'en'), 'Box');
  assert.strictEqual(VFX.L(VFX.NODE_DEFS.box.name, 'zh'), '盒子');
});

test('i18n：关卡数据保存双语文字，切换语言不需要重开', () => {
  const levels = VFX.generateLevels(VFX.createRng(42));
  levels.forEach((level) => {
    assert.ok(level.companyName && level.companyName.en && level.companyName.zh, 'companyName 不是双语');
    assert.ok(level.companySlogan && level.companySlogan.en && level.companySlogan.zh, 'companySlogan 不是双语');
    assert.ok(level.ruleName && level.ruleName.en && level.ruleName.zh, 'ruleName 不是双语');
    assert.ok(level.ruleDesc && level.ruleDesc.en && level.ruleDesc.zh, 'ruleDesc 不是双语');
  });
});

console.log(`\n${passed} 项测试通过`);
console.log('ALL TESTS PASSED');
