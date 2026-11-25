/* Node Rogue v2 — pure logic engine (browser global VFXEngine / Node CommonJS).
 * No DOM here. Story text lives in story.js (VFXStory).
 */
(function (global) {
  'use strict';

  const IS_NODE = typeof module !== 'undefined' && module.exports;
  const STORY = IS_NODE ? require('./story.js') : global.VFXStory;
  const UI_TEXT = IS_NODE ? require('./i18n.js') : global.VFXI18N;

  /* ================================================================
   * 0. helpers: i18n + rng
   * ================================================================ */
  const loc = (en, zh) => ({ en, zh });
  const LANGS = ['en', 'zh'];
  let LANG = 'en';
  function setLang(l) { if (LANGS.includes(l)) LANG = l; return LANG; }
  function getLang() { return LANG; }
  function L(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    const l = lang || LANG;
    return v[l] != null ? v[l] : (v.en != null ? v.en : '');
  }
  function t(key, vars, lang) {
    const l = lang || LANG;
    const tab = I18N[l] || I18N.en;
    let s = tab[key];
    if (s == null) s = I18N.en[key];
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => {
        if (vars[k] == null) return m;
        return typeof vars[k] === 'object' ? L(vars[k], l) : String(vars[k]);
      });
    }
    return s;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 2) / 2; // half-star rounding

  /* ================================================================
   * 1. tunables
   * ================================================================ */
  const CONFIG = {
    startCash: 1500,
    rent: 380,
    catFood: 30,
    weeks: 12,
    testWeeks: { 4: 'kiln', 8: 'northlight', 12: 'halcyon' },
    baseHours: 14,
    dailies: 3,
    startCols: 5, maxCols: 8,
    startRows: 2, maxRows: 4,
    startRam: 24, ramStep: 12, maxRam: 72,
    farmHours: 4, farmBasePrice: 90, farmPriceStep: 40,
    risk: [0, 0, 0.12, 0.25],
    qualityHours: 1,
    capUnlit: 2, capNoComp: 3.5, maxStars: 5,
    gradeMult: { C: 0.85, B: 1.1, A: 1.5, S: 2.1 },
    gradePts: { B: 3, A: 6, S: 9 },
    polishSoftCap: 3, polishSoftRate: 0.5,
    killFee: 0.15,
    solver: {
      frames: 48, detailRate: 2.6, instBase: 1.0, instAccel: 0.08,
      collisionMul: 0.6, guruMul: 0.78, animMul: 1.15,
      // Detail growth decays as the sim runs (late frames pay less), and spikes
      // get more likely over time. Together they make “when to stop” a real
      // judgement call instead of a constant frame or a constant percentage.
      detailDecay: 0.5, spikeBase: 0.03, spikePerFrame: 0.002, spikeMul: 2.6,
      // The UI only shows three bands, and each sim shifts them by ±jitter so
      // “stop when it says danger” is a good habit, not an exact rule.
      bands: { warn: 45, danger: 68, jitter: 12 },
      thresholds: [30, 60, 90, 120], qDetail: [1, 1, 1.22, 1.45], qInst: [1, 1, 1.25, 1.55]
    },
    shop: {
      courseMin: 90, courseMax: 210, courseCount: 4,
      practice: 110, cpu: [380, 520, 700], gpu: [320, 480], ram: 160,
      coffee: 45, relicCount: 2, relicMin: 220, relicMax: 360, hda: 220
    },
    gigPay: { base: 420, perWeek: 75 },
    farmMaxPerJob: 3
  };

  /* ================================================================
   * 2. departments, ports, elements, requirements
   * ================================================================ */
  const DEPTS = {
    model: { color: '#9aa7b8', name: loc('Model', '模型') },
    plate: { color: '#7fc8a9', name: loc('Footage', '实拍') },
    surf:  { color: '#c79a5a', name: loc('Surfacing', '材质') },
    char:  { color: '#e86fa3', name: loc('Rig/Anim', '绑定/动画') },
    fx:    { color: '#f08a3c', name: loc('FX', '特效') },
    light: { color: '#4f9cf0', name: loc('Lighting', '灯光') },
    comp:  { color: '#a876f0', name: loc('Comp', '合成') },
    util:  { color: '#e6e6e6', name: loc('Utility', '工具') }
  };

  const ELEMENTS = {
    fire:     { color: '#ff7a2e', name: loc('Fire', '火'), noun: [loc('Inferno', '烈焰'), loc('Firestorm', '火风暴'), loc('Ember Rain', '余烬雨'), loc('Dragon Breath', '龙息')] },
    water:    { color: '#3fb6ff', name: loc('Water', '水'), noun: [loc('Tidal Wave', '巨浪'), loc('Flash Flood', '山洪'), loc('Splashdown', '落水'), loc('Rain Wall', '雨幕')] },
    destr:    { color: '#c2a27a', name: loc('Destruction', '破碎'), noun: [loc('Collapse', '崩塌'), loc('Shatter', '粉碎'), loc('Demolition', '爆破'), loc('Meteor Hit', '陨石撞击')] },
    creature: { color: '#e86fa3', name: loc('Creature', '生物'), noun: [loc('Beast Reveal', '巨兽登场'), loc('Hero Creature', '主角生物'), loc('Night Stalker', '夜行者'), loc('Little Critter', '小怪兽')] },
    magic:    { color: '#b58cff', name: loc('Magic', '魔法'), noun: [loc('Spellcast', '施法'), loc('Portal', '传送门'), loc('Aurora', '极光'), loc('Rune Burst', '符文爆发')] }
  };
  const ELEMENT_IDS = Object.keys(ELEMENTS);

  const REQS = {
    tex:      { name: loc('Textured', '有材质'), hint: loc('Add a Surfacing node — clients hate grey models.', '加一个材质节点——客户讨厌灰模。'), test: s => !!s.tex },
    lit:      { name: loc('Lit & rendered', '打光渲染'), hint: loc('Any Lighting node renders the stream.', '任意灯光节点都会渲染。'), test: s => !!s.lit },
    final:    { name: loc('Comp\'d final', '合成成片'), hint: loc('Finish with a Comp node after Lighting.', '灯光之后接一个合成节点收尾。'), test: s => !!s.final },
    plate:    { name: loc('On the plate', '合进实拍'), hint: loc('Merge a Plate row into your CG row, then Plate Integrate.', '用 Merge 把实拍行并进 CG 行，再接 Plate Integrate。'), test: s => !!s.onPlate },
    night:    { name: loc('Night shot', '夜景'), hint: loc('Light it with Moonlight.', '用 Moonlight 打光。'), test: s => !!s.night },
    env:      { name: loc('Environment', '有环境'), hint: loc('Start a separate row with Terrain and Merge it into the main row. Terrain as the main row\'s own source does not count.', '用 Terrain 另起一行，再 Merge 进主行。Terrain 直接当主行的源不算。'), test: s => !!s.envMerged },
    stylized: { name: loc('Stylized look', '风格化'), hint: loc('Toon Shader gives the stylized look.', 'Toon Shader 给风格化外观。'), test: s => !!s.stylized },
    grain:    { name: loc('Matched grain', '匹配颗粒'), hint: loc('Lens & Grain in comp.', '合成里加 Lens & Grain。'), test: s => !!s.grain },
    smoke:    { name: loc('Smoke / dust', '烟尘'), hint: loc('Dust Pass adds smoke to any stream; Dust (after Debris) or Pyro Turbulence also work.', '烟尘层可以给任何数据流加烟；Dust（接在 Debris 后）或 Turbulence 也行。'), test: s => !!s.smoke },
    polish:   { name: loc('Polish ≥ {n}', '打磨 ≥ {n}'), hint: loc('Grade, Three-Point, look-dev matches and quality tiers add polish. The same source counts once; quality tiers count per node.', 'Grade、三点光、材质对口和质量档都加打磨。同一种来源只算一次；质量档按节点计。'), test: (s, n) => (s.polish || 0) >= n }
  };

  /* ================================================================
   * 3. nodes
   * ================================================================ */
  function newStream() {
    return {
      geo: false, organic: false, hard: false, env: false, envMerged: false, scanned: false, plate: false,
      tex: false, texMatch: false, stylized: false, rig: false, anim: false,
      lit: false, night: false, final: false, onPlate: false, grain: false, smoke: false,
      polish: 0, polishSrc: {}, usdMerged: false, gradeStar: false,
      dead: false, deadEl: null, deadStep: 0,
      step: { fire: 0, water: 0, destr: 0, creature: 0, magic: 0 },
      bonus: { fire: 0, water: 0, destr: 0, creature: 0, magic: 0 },
      depts: [], model: null, log: [], rows: 1
    };
  }
  function cloneStream(s) {
    const n = Object.assign({}, s);
    n.step = Object.assign({}, s.step);
    n.bonus = Object.assign({}, s.bonus);
    n.depts = s.depts.slice();
    n.log = s.log.slice();
    n.polishSrc = Object.assign({}, s.polishSrc || {});
    return n;
  }
  function addDept(s, d) { if (!s.depts.includes(d)) s.depts.push(d); }
  /* Polish diminishing returns: one contribution per polish *source*.
   * Same node type = same source (two Grades count once). Quality-tier polish
   * is passed a per-cell key, so each graded node still counts separately. */
  function addPolish(s, key, amt) {
    if (!amt) return 0;
    if (key == null) { s.polish += amt; return amt; }
    if (!s.polishSrc) s.polishSrc = {};
    if (s.polishSrc[key]) return 0;
    s.polishSrc[key] = 1;
    s.polish += amt;
    return amt;
  }
  function losePolish(s, amt) { s.polish = Math.max(0, s.polish - amt); }
  // Quality-tier polish counts once per node (exempt from the one-per-source
  // rule) but only half a point per tier: stacking tiers is a star/detail play,
  // not a polish pump.
  const tierPolish = (ctx) => (ctx.fail ? 0 : 0.5 * Math.max(0, (ctx.card.q || 1) - 1));
  const tierStars = (ctx) => (ctx.fail ? 0 : 0.5 * Math.max(0, (ctx.card.q || 1) - 1));

  function heroStep(el, step, extra) {
    // generic hero-chain node: requires previous step, sets step
    return {
      check(s) {
        if (step === 1) {
          if (extra && extra.needs && !extra.needs(s)) return extra.needsErr;
          if (!s.geo && !(extra && extra.anyStream)) return 'err.needGeo';
          return null;
        }
        if (s.step[el] < step - 1) return 'err.needStep';
        return null;
      },
      apply(s, ctx) {
        if (ctx.fail) {
          // A failed quality roll is a weaker take, not a broken chain: the step
          // still counts (and its function — smoke, anim, rig — is kept), but it
          // loses the tier bonus and half a star.
          s.log.push('fail.' + ctx.def.dept);
          s.step[el] = Math.max(s.step[el], step);
          s.bonus[el] -= 0.5;
        } else {
          s.step[el] = Math.max(s.step[el], step);
          s.bonus[el] += tierStars(ctx);
        }
        if (extra && extra.apply) extra.apply(s, ctx);
      },
      hero: { el, step }
    };
  }

  function solverNode(el, step) {
    return {
      solver: true,
      hero: { el, step },
      check(s) { return s.step[el] < step - 1 ? 'err.needStep' : null; },
      apply(s, ctx) {
        const r = ctx.solver;
        if (r && r.diverged) {
          s.dead = true; s.deadEl = el; s.deadStep = step; s.log.push('diverged');
          return;
        }
        s.step[el] = Math.max(s.step[el], step);
        if (r) s.bonus[el] += r.bonus || 0;
        if (s.anim && el !== 'creature') s.bonus[el] += 0.5; // character drives the sim
      }
    };
  }

  const N = {};
  function def(id, o) { o.id = id; N[id] = o; return o; }

  // --- MODEL (sources) ---
  def('box', { dept: 'model', h: 1, ram: 2, q: true, source: true,
    name: loc('Box', '盒子'), desc: loc('Basic geometry. Starts a stream.', '基础几何体，起一条数据流。'),
    apply(s, ctx) { s.geo = true; s.model = 'box'; if (ctx.fail) s.log.push('fail.model'); addPolish(s, 'q:' + ctx.key, tierPolish(ctx)); } });
  def('sculpt', { dept: 'model', h: 2, ram: 6, q: true, source: true,
    name: loc('Sculpt', '雕刻'), desc: loc('Organic geo. Creatures need it. Pairs with Skin Shader.', '有机模型。生物需要它；和 Skin Shader 对口。'),
    apply(s, ctx) { s.geo = true; s.organic = true; s.model = 'organic'; if (ctx.fail) s.log.push('fail.model'); addPolish(s, 'q:' + ctx.key, tierPolish(ctx)); } });
  def('hardsurf', { dept: 'model', h: 2, ram: 4, q: true, source: true,
    name: loc('Hard Surface', '硬表面'), desc: loc('Hard-surface geo. Fracture +0.5★. Pairs with Metal Shader.', '硬表面模型。Fracture +0.5★；和 Metal Shader 对口。'),
    apply(s, ctx) { s.geo = true; s.hard = true; s.model = 'hard'; if (ctx.fail) s.log.push('fail.model'); addPolish(s, 'q:' + ctx.key, tierPolish(ctx)); } });
  def('terrain', { dept: 'model', h: 2, ram: 6, q: true, source: true,
    name: loc('Terrain', '地形'), desc: loc('Environment geo. Merge it in from a side row to satisfy “Environment”. Pairs with Texture Paint.', '环境模型。从另一行 Merge 进来才能满足“有环境”；和 Texture Paint 对口。'),
    apply(s, ctx) { s.geo = true; s.env = true; s.envMerged = false; s.model = 'env'; if (ctx.fail) s.log.push('fail.model'); addPolish(s, 'q:' + ctx.key, tierPolish(ctx)); } });
  def('scan', { dept: 'model', h: 3, ram: 8, q: true, source: true,
    name: loc('Photo Scan', '扫描模型'), desc: loc('Scanned asset: comes textured, +1 polish. Heavy.', '扫描资产：自带材质，+1 打磨。很吃内存。'),
    apply(s, ctx) { s.geo = true; s.scanned = true; s.tex = true; s.hard = true; s.model = 'scan'; s.polish += 1; if (ctx.fail) s.log.push('fail.model'); addPolish(s, 'q:' + ctx.key, tierPolish(ctx)); } });
  def('plate', { dept: 'plate', h: 0, ram: 2, source: true,
    name: loc('Plate', '实拍素材'), desc: loc('Live-action footage. Merge it into a CG row.', '实拍画面。用 Merge 并进 CG 行。'),
    apply(s) { s.plate = true; s.model = s.model || null; } });

  // --- SURFACING ---
  function surf(id, o) {
    o.dept = 'surf'; o.q = true;
    o.check = s => (!s.geo ? 'err.needGeo' : null);
    const extra = o.extra;
    o.apply = function (s, ctx) {
      if (ctx.fail) {
        // Textures dropped, but the stream is still textured and the look's
        // functional traits (Toon stylized, etc.) stay: weaker take, no match
        // polish, no tier polish, −1 polish.
        s.log.push('fail.surf');
        s.tex = true;
        losePolish(s, 1);
        if (extra) extra(s, ctx);
        return;
      }
      s.tex = true;
      addPolish(s, 'q:' + ctx.key, tierPolish(ctx));
      const m = o.match(s);
      if (m === true) {
        s.texMatch = true;
        addPolish(s, 'match:' + id, (o.matchPolish || 1) + (ctx.relics.has('lookdev') ? 1 : 0));
      } else if (m === false) addPolish(s, 'mismatch:' + id, -1);
      if (extra) extra(s, ctx);
    };
    return def(id, o);
  }
  surf('shader', { h: 0, ram: 2, name: loc('Basic Shader', '基础材质'), desc: loc('Free (0h) texture. No look-dev match.', '免费（0 工时）上材质，不算对口。'), match: () => null });
  surf('paint', { h: 2, ram: 4, name: loc('Texture Paint', '手绘贴图'), desc: loc('Big match: Terrain or Sculpt (+2 polish). Hard surface: mismatch −1.', '大口对：Terrain 或 Sculpt（+2 打磨）。硬表面不对口 −1。'), matchPolish: 2, match: s => (s.env || s.organic) ? true : (s.hard ? false : null) });
  surf('skin', { h: 2, ram: 4, name: loc('Skin Shader', '皮肤材质'), desc: loc('SSS skin. Match: Sculpt (+1 polish, creature +0.5★). Mismatch −1.', 'SSS 皮肤。对口 Sculpt（+1 打磨，生物 +0.5★），不对口 −1。'), match: s => s.organic ? true : false,
    extra: (s, ctx) => { if (s.organic && !ctx.fail) s.bonus.creature += 0.5; } });
  surf('metal', { h: 2, ram: 4, name: loc('Metal Shader', '金属材质'), desc: loc('Big match: Hard Surface / Scan (+2 polish). Mismatch −1.', '大口对：硬表面 / 扫描（+2 打磨），不对口 −1。'), matchPolish: 2, match: s => s.hard ? true : false });
  surf('toon', { h: 1, ram: 2, name: loc('Toon Shader', '卡通材质'), desc: loc('Stylized look. Always a match (+1 polish), but never “realistic”.', '风格化外观。总算对口（+1 打磨），但永远不写实。'), match: () => true, extra: s => { s.stylized = true; } });

  // --- RIG / ANIM (creature chain) ---
  def('rig', Object.assign({ dept: 'char', h: 2, ram: 3, q: true,
    name: loc('Rig', '绑定'), desc: loc('Creature ★1. Needs Sculpt geo.', '生物 ★1。需要 Sculpt 模型。') },
  heroStep('creature', 1, { needs: s => s.organic, needsErr: 'err.needOrganic', apply: s => { s.rig = true; } })));
  def('animate', Object.assign({ dept: 'char', h: 3, ram: 3, q: true,
    name: loc('Animate', '动画'), desc: loc('Creature ★2.5: +0.5★ over a plain step, and animated input gives later FX solvers +0.5★. Can be graded.', '生物 ★2.5：比普通一步多 +0.5★，且之后的 FX 解算器吃到动画 +0.5★。可以上质量档。') },
  heroStep('creature', 2, { apply: s => { s.anim = true; s.bonus.creature += 0.5; } })));
  def('mocap', Object.assign({ dept: 'char', h: 2, ram: 2,
    name: loc('Mocap Cleanup', '动捕清理'), desc: loc('Creature ★2, no risk, no tiers. 1h cheaper than Animate. Cheap and steady.', '生物 ★2，零风险没有质量档，比 Animate 便宜 1 小时。便宜稳妥。') },
  heroStep('creature', 2, { apply: s => { s.anim = true; } })));
  def('muscle', Object.assign({ dept: 'char', h: 2, ram: 4, q: true,
    name: loc('Muscle Jiggle', '肌肉抖动'), desc: loc('Creature ★3 — the safe alternative to Vellum.', '生物 ★3——Vellum 的稳妥替代。') },
  heroStep('creature', 3)));
  def('vellum', Object.assign({ dept: 'fx', h: 2, ram: 8, q: true,
    name: loc('Vellum Cloth', 'Vellum 布料'), desc: loc('SOLVER. Creature ★3 + live sim bonus.', '解算器。生物 ★3 + 实时解算加成。') },
  solverNode('creature', 3)));
  def('groom', Object.assign({ dept: 'char', h: 3, ram: 6, q: true,
    name: loc('Groom', '毛发'), desc: loc('Creature ★4. Fur sells the creature.', '生物 ★4。毛发让生物成立。') },
  heroStep('creature', 4)));

  // --- FX: fire ---
  def('pyrosrc', Object.assign({ dept: 'fx', h: 1, ram: 2, q: true,
    name: loc('Pyro Source', '火源'), desc: loc('Fire ★1. Emits fuel from geo.', '火 ★1。从模型发射燃料。') }, heroStep('fire', 1)));
  def('pyro', Object.assign({ dept: 'fx', h: 2, ram: 12, q: true,
    name: loc('Pyro Solver', 'Pyro 解算'), desc: loc('SOLVER. Fire ★2 + live sim bonus.', '解算器。火 ★2 + 实时解算加成。') }, solverNode('fire', 2)));
  def('turb', Object.assign({ dept: 'fx', h: 1, ram: 4, q: true,
    name: loc('Turbulence', '湍流'), desc: loc('Fire ★3. Adds smoke.', '火 ★3。会产生烟。') }, heroStep('fire', 3, { apply: s => { s.smoke = true; } })));
  def('upres', Object.assign({ dept: 'fx', h: 3, ram: 18, q: true,
    name: loc('Upres', '升分辨率'), desc: loc('Fire ★4. Heavy on RAM.', '火 ★4。很吃内存。') }, heroStep('fire', 4)));
  // --- FX: water ---
  def('flipsrc', Object.assign({ dept: 'fx', h: 1, ram: 2, q: true,
    name: loc('FLIP Source', '流体源'), desc: loc('Water ★1.', '水 ★1。') }, heroStep('water', 1)));
  def('flip', Object.assign({ dept: 'fx', h: 3, ram: 18, q: true,
    name: loc('FLIP Solver', 'FLIP 解算'), desc: loc('SOLVER. Water ★2 + live sim bonus. Very heavy.', '解算器。水 ★2 + 实时解算加成。非常重。') }, solverNode('water', 2)));
  def('white', Object.assign({ dept: 'fx', h: 2, ram: 6, q: true,
    name: loc('Whitewater', '白水'), desc: loc('Water ★3. Foam and spray.', '水 ★3。泡沫和水花。') }, heroStep('water', 3)));
  def('mesher', Object.assign({ dept: 'fx', h: 2, ram: 16, q: true,
    name: loc('Mesher', '网格化'), desc: loc('Water ★4.', '水 ★4。') }, heroStep('water', 4)));
  // --- FX: destruction ---
  def('fracture', Object.assign({ dept: 'fx', h: 1, ram: 3, q: true,
    name: loc('Fracture', '破碎'), desc: loc('Destruction ★1. +0.5★ on Hard Surface.', '破碎 ★1。硬表面上 +0.5★。') },
  heroStep('destr', 1, { apply: s => { if (s.hard) s.bonus.destr += 0.5; } })));
  def('rbd', Object.assign({ dept: 'fx', h: 2, ram: 10, q: true,
    name: loc('RBD Solver', '刚体解算'), desc: loc('SOLVER. Destruction ★2 + live sim bonus.', '解算器。破碎 ★2 + 实时解算加成。') }, solverNode('destr', 2)));
  def('debris', Object.assign({ dept: 'fx', h: 1, ram: 4, q: true,
    name: loc('Debris', '碎屑'), desc: loc('Destruction ★3.', '破碎 ★3。') }, heroStep('destr', 3)));
  def('dust', Object.assign({ dept: 'fx', h: 2, ram: 8, q: true,
    name: loc('Dust', '烟尘'), desc: loc('Destruction ★4. Adds smoke.', '破碎 ★4。会产生烟。') }, heroStep('destr', 4, { apply: s => { s.smoke = true; } })));
  def('dustpass', { dept: 'fx', h: 1, ram: 2,
    name: loc('Dust Pass', '烟尘层'), desc: loc('Adds smoke/dust to any geo or sim stream. No hero star. Satisfies “Smoke / dust”.', '给任意模型或解算流加上烟尘，不加主角星。满足“烟尘”。'),
    apply(s) { s.smoke = true; } });
  // --- FX: magic ---
  def('popsrc', Object.assign({ dept: 'fx', h: 1, ram: 2, q: true,
    name: loc('Particles', '粒子'), desc: loc('Magic ★1. Works on geo or a Plate.', '魔法 ★1。模型或实拍上都能发射。') },
  heroStep('magic', 1, { anyStream: true })));
  def('pop', Object.assign({ dept: 'fx', h: 2, ram: 6, q: true,
    name: loc('POP Solver', '粒子解算'), desc: loc('SOLVER. Magic ★2 + live sim bonus.', '解算器。魔法 ★2 + 实时解算加成。') }, solverNode('magic', 2)));
  def('trails', Object.assign({ dept: 'fx', h: 1, ram: 3, q: true,
    name: loc('Trails', '拖尾'), desc: loc('Magic ★3.', '魔法 ★3。') }, heroStep('magic', 3)));

  // --- LIGHTING ---
  function light(id, o) {
    o.dept = 'light';
    if (o.q == null) o.q = true;
    const base = o.extra;
    o.check = o.check || (s => (!s.geo ? 'err.needGeo' : null));
    o.apply = function (s, ctx) {
      s.lit = true;
      if (!s.tex && !s.stylized) s.polish -= 1; // grey model lit = ugly
      if (base) base(s, ctx);
      if (!ctx.fail) addPolish(s, 'q:' + ctx.key, tierPolish(ctx));
      // A failed roll keeps the function (lit, night, fire boost) but costs 1
      // polish, applied after the node's own bonus so it is a real −1.
      if (ctx.fail) { losePolish(s, 1); s.log.push('fail.light'); }
    };
    return def(id, o);
  }
  light('light', { h: 1, ram: 3, name: loc('Basic Light', '基础灯光'), desc: loc('Lights & renders the stream. Cheap in RAM.', '打光并渲染。占用内存少。') });
  light('threept', { h: 2, ram: 4, name: loc('Three-Point', '三点布光'), desc: loc('Lit, +1 polish.', '打光，+1 打磨。'), extra: s => { addPolish(s, 'threept', 1); } });
  light('hdri', { h: 1, ram: 4, name: loc('HDRI Dome', 'HDRI 环境光'), desc: loc('Lit. +2 polish if Environment is in the stream.', '打光。流里有环境时 +2 打磨。'), extra: s => { if (s.env) addPolish(s, 'hdri', 2); } });
  light('moon', { h: 1, ram: 4, name: loc('Moonlight', '月光'), desc: loc('Lit, makes it a night shot.', '打光，变成夜景。'), extra: s => { s.night = true; } });
  light('firelight', { h: 2, ram: 6, name: loc('Fire Light', '火光照明'), desc: loc('Needs fire. Lit, fire +0.5★, +1 polish.', '需要火。打光，火 +0.5★，+1 打磨。'),
    check: s => (!s.geo ? 'err.needGeo' : (s.step.fire < 1 ? 'err.needFire' : null)),
    extra: s => { s.bonus.fire += 0.5; addPolish(s, 'firelight', 1); } });
  light('pathtrace', { h: 5, ram: 16, name: loc('Path Tracer', '路径追踪'), desc: loc('Lit, +2 polish. Slow, heavy.', '打光，+2 打磨。又慢又重。'), extra: s => { addPolish(s, 'pathtrace', 2); } });

  // --- COMP ---
  function comp(id, o) {
    o.dept = 'comp';
    if (o.q == null) o.q = true;
    const base = o.extra;
    o.check = o.check || (s => (!s.lit ? 'err.needLit' : null));
    o.apply = function (s, ctx) {
      s.final = true;
      if (!ctx.fail) addPolish(s, 'q:' + ctx.key, tierPolish(ctx));
      if (base) base(s, ctx);
      // Nuke Hotkeys: every Comp node adds +1 polish, exempt from the
      // one-per-source rule (per node, even duplicates).
      if (ctx.relics.has('hotkeys')) s.polish += 1;
      if (ctx.fail) { losePolish(s, 1); s.log.push('fail.comp'); }
    };
    return def(id, o);
  }
  comp('comp', { h: 1, ram: 2, name: loc('Basic Comp', '基础合成'), desc: loc('Finishes the shot (final).', '完成镜头（成片）。') });
  comp('plateint', { h: 2, ram: 4, name: loc('Plate Integrate', '实拍合成'), desc: loc('Needs a Plate merged in. Final + “On the plate”.', '需要并进实拍。成片 + 合进实拍。'),
    check: s => (!s.lit ? 'err.needLit' : (!s.plate ? 'err.needPlate' : null)),
    extra: s => { s.onPlate = true; } });
  comp('grade', { h: 1, ram: 2, name: loc('Grade', '调色'), desc: loc('Final, +1 polish (+1 more with LUT Library). At polish ≥5, +0.5★.', '成片，+1 打磨（LUT 库再 +1）。打磨 ≥5 时 +0.5★。'),
    extra: (s, ctx) => { addPolish(s, 'grade', 1 + (ctx.relics.has('lut') ? 1 : 0)); s.gradeStar = true; } });
  comp('lens', { h: 1, ram: 2, name: loc('Lens & Grain', '镜头与颗粒'), desc: loc('Final, matched grain, +1 polish.', '成片，匹配颗粒，+1 打磨。'), extra: s => { s.grain = true; addPolish(s, 'lens', 1); } });
  comp('haze', { h: 1, ram: 2, name: loc('Heat Haze', '热浪扭曲'), desc: loc('Needs fire. Final, fire +0.5★.', '需要火。成片，火 +0.5★。'),
    check: s => (!s.lit ? 'err.needLit' : (s.step.fire < 1 ? 'err.needFire' : null)), extra: s => { s.bonus.fire += 0.5; } });
  def('glow', { dept: 'comp', h: 1, ram: 2, q: true, hero: { el: 'magic', step: 4 },
    name: loc('Glow', '辉光'), desc: loc('Magic ★4. Needs Trails and Lighting. Final.', '魔法 ★4。需要拖尾和灯光。成片。'),
    check: s => (!s.lit ? 'err.needLit' : (s.step.magic < 3 ? 'err.needStep' : null)),
    apply(s, ctx) {
      s.final = true;
      if (ctx.relics.has('hotkeys')) s.polish += 1;
      if (ctx.fail) {
        s.log.push('fail.comp');
        s.step.magic = Math.max(s.step.magic, 4);
        s.bonus.magic -= 0.5;
        losePolish(s, 1);
        return;
      }
      s.step.magic = Math.max(s.step.magic, 4);
      s.bonus.magic += tierStars(ctx);
    } });
  def('roto', { dept: 'comp', h: 2, ram: 2, rescue: true,
    name: loc('Roto Rescue', 'Roto 救场'), desc: loc('“Fix it in comp.” Revives a diverged sim one ★ lower. Final if lit.', '“后期再修”。把发散的解算救回来，低一档。打过光则成片。'),
    check: s => null,
    apply(s) {
      if (s.dead) {
        s.dead = false;
        s.step[s.deadEl] = Math.max(s.step[s.deadEl], s.deadStep - 1);
        s.log.push('rescued');
        s.deadEl = null;
      }
      if (s.lit) s.final = true;
    } });

  // --- UTILITY ---
  def('merge', { dept: 'util', h: 1, ram: 2, merge: true,
    name: loc('Merge', '合并'), desc: loc('Combines the streams from left, upper-left and lower-left.', '合并左、左上、左下三路数据流。') });
  def('collision', { dept: 'util', h: 1, ram: 2, util: true,
    name: loc('Collision', '碰撞体'), desc: loc('Solvers directly left, above or below it are 40% more stable. Passes stream through.', '紧挨着的左/上/下解算器稳定 40%。数据直通。') });

  const NODE_DEFS = N;
  const NODE_IDS = Object.keys(N);

  /* ================================================================
   * 4. relics
   * ================================================================ */
  const RELICS = {
    guru:     { icon: 'guru', name: loc('Houdini Guru', 'Houdini 大神'), desc: loc('All solvers 22% more stable.', '所有解算器稳定 22%。') },
    nerd_fire:     { icon: 'nerd', el: 'fire', name: loc('Pyro Nerd', '火焰狂人'), desc: loc('Fire +0.5★; +0.5★ more if fire is the only hero element.', '火 +0.5★；镜头里只有火时再 +0.5★。') },
    nerd_water:    { icon: 'nerd', el: 'water', name: loc('Water Wrangler', '驯水师'), desc: loc('Water +0.5★; +0.5★ more if it is the only hero element.', '水 +0.5★；只有水时再 +0.5★。') },
    nerd_destr:    { icon: 'nerd', el: 'destr', name: loc('Demolition Fan', '拆迁爱好者'), desc: loc('Destruction +0.5★; +0.5★ more if alone.', '破碎 +0.5★；只有破碎时再 +0.5★。') },
    nerd_creature: { icon: 'nerd', el: 'creature', name: loc('Creature Whisperer', '生物低语者'), desc: loc('Creature +0.5★; +0.5★ more if alone.', '生物 +0.5★；只有生物时再 +0.5★。') },
    nerd_magic:    { icon: 'nerd', el: 'magic', name: loc('Spell Weaver', '织法者'), desc: loc('Magic +0.5★; +0.5★ more if alone.', '魔法 +0.5★；只有魔法时再 +0.5★。') },
    usd:      { icon: 'usd', name: loc('USD Pipeline', 'USD 管线'), desc: loc('Merge costs 0h, and the merged stream gets +0.5★ (hero element).', 'Merge 不耗时，合并后的数据流 +0.5★（主角元素）。') },
    farm:     { icon: 'farm', name: loc('Farm Account', '农场账户'), desc: loc('Render farm hours cost half, and each rental gives +1h.', '渲染农场半价，而且每次租用多给 +1 小时。') },
    caffeine: { icon: 'coffee', name: loc('Caffeine Habit', '咖啡因依赖'), desc: loc('+5h every week. Rent +$25 (coffee).', '每周 +5 小时。房租 +$25（咖啡钱）。') },
    monitor:  { icon: 'monitor', name: loc('Second Monitor', '第二块屏'), desc: loc('See hidden client requirements before the first cook; those jobs get +1 polish.', '第一次 Cook 前就能看到客户的隐藏要求；有隐藏要求的活 +1 打磨。') },
    notebook: { icon: 'book', name: loc('Mira\'s Notebook', 'Mira 的笔记本'), desc: loc('+1 dailies per job.', '每个活 +1 次 dailies。') },
    backup:   { icon: 'drive', name: loc('Backup Drive', '备份硬盘'), desc: loc('Immune to hardware disasters, and +2h every job.', '免疫硬件灾难事件，而且每个活 +2 小时。') },
    lut:      { icon: 'lut', name: loc('LUT Library', 'LUT 库'), desc: loc('Grade gives +1 more polish.', 'Grade 多 +1 打磨。') },
    wedge:    { icon: 'wedge', name: loc('Wedge Script', 'Wedge 脚本'), desc: loc('Sim viewer shows the predicted divergence frame; solvers are 8% steadier.', '解算窗口显示预测的发散帧；解算器稳定 8%。') },
    hda:      { icon: 'hda', name: loc('HDA Toolkit', 'HDA 工具箱'), desc: loc('Unlocks “Package HDA” in the shop: fuse two nodes into one cell.', '商店解锁“打包 HDA”：两个节点合成一格。') },
    pip:      { icon: 'cat', name: loc('Pip on the Desk', '桌上的 Pip'), desc: loc('Once per job a failed quality roll is undone, and Pip adds +1 polish to every shot. (Pip hit Ctrl+Z.)', '每个活一次撤销失败的质量判定，而且 Pip 给每个镜头 +1 打磨（Pip 踩到了 Ctrl+Z）。') },
    website:  { icon: 'web', name: loc('Portfolio Website', '作品集网站'), desc: loc('Studio tests: +2 polish. Reel shots +$60 when delivered.', '工作室测试 +2 打磨。每个进 reel 的镜头 +$60。') },
    hotkeys:  { icon: 'keys', name: loc('Nuke Hotkeys', 'Nuke 快捷键'), desc: loc('Every Comp node gives +1 polish (stacks, even duplicates).', '每个合成节点 +1 打磨（可以叠，重复节点也算）。') },
    lookdev:  { icon: 'eye', name: loc('Look-dev Eye', '材质眼'), desc: loc('Look-dev matches give +1 more polish.', '材质对口多 +1 打磨。') },
    confidence: { icon: 'star', name: loc('Quiet Confidence', '底气'), desc: loc('You turned down an offer. +1 dailies on studio tests, +1 polish everywhere.', '你拒绝过 offer。工作室测试 +1 dailies，所有镜头 +1 打磨。') }
  };
  const SHOP_RELICS = ['guru', 'usd', 'farm', 'caffeine', 'monitor', 'notebook', 'backup', 'lut', 'wedge', 'hda', 'website', 'hotkeys', 'lookdev',
    'nerd_fire', 'nerd_water', 'nerd_destr', 'nerd_creature', 'nerd_magic'];

  /* ================================================================
   * 5. backgrounds (starting builds)
   * ================================================================ */
  const BASICS = ['box', 'box', 'shader', 'light', 'light', 'comp', 'comp', 'merge', 'plate'];
  const BACKGROUNDS = {
    pyro:     { el: 'fire', relic: 'nerd_fire', cards: ['pyrosrc', 'pyro', 'turb', 'collision', 'hardsurf'], cash: 0,
      name: loc('Pyro TD', 'Pyro TD'), desc: loc('Fire specialist. Starts with a Pyro chain and Pyro Nerd.', '火焰专精。开局有 Pyro 链和火焰狂人。') },
    water:    { el: 'water', relic: 'nerd_water', cards: ['flipsrc', 'flip', 'white', 'collision', 'terrain'], cash: 0,
      name: loc('Water Wrangler', '驯水师'), desc: loc('Water specialist. FLIP chain, but FLIP is heavy.', '水专精。FLIP 链，但 FLIP 很重。') },
    creature: { el: 'creature', relic: 'nerd_creature', cards: ['sculpt', 'skin', 'rig', 'mocap', 'muscle'], cash: 0,
      name: loc('Creature Artist', '生物艺术家'), desc: loc('Creature specialist. Safe, steady chain with no solver.', '生物专精。稳的链，没有解算器。') },
    generalist: { el: null, relic: 'usd', cards: ['fracture', 'rbd', 'popsrc', 'threept', 'grade', 'hardsurf'], cash: 200,
      name: loc('Generalist', '多面手'), desc: loc('A bit of everything, USD Pipeline and +$200.', '什么都会一点，USD 管线，+$200。') }
  };

  /* ================================================================
   * 6. evaluate a grid
   * ================================================================ */
  function emptyGrid(rows, cols) {
    const g = [];
    for (let r = 0; r < rows; r++) { g.push(new Array(cols).fill(null)); }
    return g;
  }
  let UID = 1;
  function makeCard(type, o) {
    return Object.assign({ uid: 'c' + (UID++), type, q: 1, up: 0 }, o || {});
  }
  function cardParts(card) { return card.parts && card.parts.length ? card.parts : [card.type]; }
  function cardDept(card) { return NODE_DEFS[cardParts(card)[0]].dept; }
  function isSolverCard(card) { return cardParts(card).some(p => NODE_DEFS[p].solver); }
  function cardHasQuality(card) { return !card.parts && !!NODE_DEFS[card.type].q; }

  function cardHours(card, relics) {
    relics = relics instanceof Set ? relics : new Set(relics || []);
    const parts = cardParts(card);
    let h = 0;
    for (const p of parts) {
      const d = NODE_DEFS[p];
      let x = d.h;
      if (d.merge && relics.has('usd')) x = 0;
      h += x;
    }
    if (parts.length > 1) h -= 1;
    h += ((card.q || 1) - 1) * CONFIG.qualityHours;
    h -= (card.up || 0);
    return Math.max(0, h);
  }
  function cardRam(card) {
    const parts = cardParts(card);
    let r = 0;
    for (const p of parts) r = Math.max(r, NODE_DEFS[p].ram);
    return Math.round(r * (1 + 0.5 * ((card.q || 1) - 1)));
  }
  function cardRisk(card) {
    if (!cardHasQuality(card) || isSolverCard(card)) return 0;
    const q = card.q || 1;
    return CONFIG.risk[q] * ((card.up || 0) > 0 ? 0.5 : 1);
  }

  function mergeStreams(list) {
    const valid = list.filter(Boolean);
    if (!valid.length) return null;
    const s = cloneStream(valid[0]);
    for (let i = 1; i < valid.length; i++) {
      const o = valid[i];
      for (const k of ['geo', 'organic', 'hard', 'env', 'envMerged', 'scanned', 'plate', 'tex', 'texMatch', 'stylized', 'rig', 'anim', 'lit', 'night', 'final', 'onPlate', 'grain', 'smoke', 'usdMerged', 'gradeStar']) s[k] = s[k] || o[k];
      for (const e of ELEMENT_IDS) {
        if (o.step[e] > s.step[e] || (o.step[e] === s.step[e] && o.bonus[e] > s.bonus[e])) { s.step[e] = o.step[e]; s.bonus[e] = o.bonus[e]; }
      }
      s.polish = Math.max(s.polish, o.polish) + Math.min(s.polish, o.polish) * 0.5;
      for (const k in (o.polishSrc || {})) s.polishSrc[k] = 1;
      if (o.dead && !s.dead) { s.dead = true; s.deadEl = o.deadEl; s.deadStep = o.deadStep; }
      for (const d of o.depts) addDept(s, d);
      if (!s.model && o.model) s.model = o.model;
      s.rows += o.rows;
    }
    s.polish = round1(s.polish);
    return s;
  }

  function collisionNear(grid, r, c) {
    const R = grid.length;
    const isCol = (rr, cc) => rr >= 0 && rr < R && cc >= 0 && grid[rr][cc] && cardParts(grid[rr][cc]).includes('collision');
    return isCol(r - 1, c) || isCol(r + 1, c) || isCol(r, c + 1) || isCol(r, c - 1);
  }

  /* stars for a final stream */
  function streamStars(s, relics, el) {
    relics = relics instanceof Set ? relics : new Set(relics || []);
    if (!s || s.dead) return 0;
    let v = s.step[el] > 0 ? s.step[el] + s.bonus[el] : 0;
    if (v <= 0) return 0;
    const heroes = ELEMENT_IDS.filter(e => s.step[e] > 0);
    if (relics.has('nerd_' + el)) v += 0.5 + (heroes.length === 1 ? 0.5 : 0);
    // USD Pipeline: a merged stream carries +0.5★ (a very good merge).
    if (relics.has('usd') && s.usdMerged) v += 0.5;
    // Grade is now the polish node that can tip a polished shot into a star.
    if (s.gradeStar && (s.polish || 0) >= 5) v += 0.5;
    let cap = CONFIG.maxStars;
    if (!s.lit) cap = CONFIG.capUnlit; else if (!s.final) cap = CONFIG.capNoComp;
    return clamp(round1(v), 0, cap);
  }
  function streamCap(s) { if (!s) return 0; if (!s.lit) return CONFIG.capUnlit; if (!s.final) return CONFIG.capNoComp; return CONFIG.maxStars; }
  function dominantElement(s, relics) {
    if (!s) return null;
    let best = null, bv = 0;
    for (const e of ELEMENT_IDS) { const v = streamStars(s, relics, e); if (v > bv) { bv = v; best = e; } }
    return best;
  }

  function evaluate(grid, o) {
    o = o || {};
    const R = grid.length, C = grid[0].length;
    const relics = o.relics instanceof Set ? o.relics : new Set(o.relics || []);
    const solverRes = o.solverResults || {};
    const fails = o.fails || {};
    const streams = [], sigs = [], cells = [];
    for (let r = 0; r < R; r++) { streams.push([]); sigs.push([]); cells.push([]); }
    let hours = 0;
    const colRam = new Array(C).fill(0);
    for (let c = 0; c < C; c++) {
      for (let r = 0; r < R; r++) {
        const prev = c > 0 ? streams[r][c - 1] : null;
        const prevSig = c > 0 ? sigs[r][c - 1] : '';
        const card = grid[r][c];
        if (!card) { streams[r][c] = prev; sigs[r][c] = prevSig; cells[r][c] = { empty: true, stream: prev }; continue; }
        const key = r + ',' + c;
        hours += cardHours(card, relics);
        colRam[c] += cardRam(card);
        const parts = cardParts(card);
        let sig = (card.parts ? card.parts.join('+') : card.type) + ':' + (card.q || 1) + ':' + (card.up || 0) + ':' + (card.nonce || 0) + '<' + prevSig + '>';
        let s = prev ? cloneStream(prev) : null;
        let err = null;
        for (const p of parts) {
          const d = NODE_DEFS[p];
          const ctx = { card, def: d, key, r, c, relics, solver: solverRes[key], fail: !!fails[key], grid };
          if (d.source) {
            s = newStream(); d.apply(s, ctx); addDept(s, d.dept);
          } else if (d.merge) {
            const up = (r > 0 && c > 0) ? streams[r - 1][c - 1] : null;
            const dn = (r < R - 1 && c > 0) ? streams[r + 1][c - 1] : null;
            sig += '{' + (r > 0 && c > 0 ? sigs[r - 1][c - 1] : '') + '|' + (r < R - 1 && c > 0 ? sigs[r + 1][c - 1] : '') + '}';
            const sideEnv = !!(up && up.env) || !!(dn && dn.env);
            const baseEnvMerged = !!(s && s.envMerged);
            const m = mergeStreams([s, up, dn]);
            if (!m) { err = 'err.noInput'; break; }
            s = m; addDept(s, 'util');
            // Environment only counts when the Terrain row is merged in from a
            // side row — Terrain as the main row's own source does not count.
            s.envMerged = baseEnvMerged || sideEnv;
            if (relics.has('usd')) s.usdMerged = true;
          } else if (d.util) {
            // passthrough (stream may be null)
          } else {
            if (!s) { err = 'err.noInput'; break; }
            if (s.dead && !d.rescue) { err = 'err.deadInput'; break; }
            const e = d.check ? d.check(s, ctx) : null;
            if (e) { err = e; break; }
            d.apply(s, ctx);
            addDept(s, d.dept);
          }
        }
        if (err && !(err === 'err.deadInput' && s && s.dead)) s = null;
        streams[r][c] = s;
        sigs[r][c] = hashStr(sig);
        cells[r][c] = { status: err ? 'err' : 'ok', err, stream: s, key, solver: isSolverCard(card), collision: isSolverCard(card) && collisionNear(grid, r, c) };
      }
    }
    const rowOut = [];
    for (let r = 0; r < R; r++) rowOut.push(streams[r][C - 1] || null);
    const ramPeak = Math.max(0, ...colRam);
    // overall polish relics (each is a unique source, once per row)
    if (relics.has('confidence')) rowOut.forEach(s => { if (s) s.polish += 1; });
    if (relics.has('pip')) rowOut.forEach(s => { if (s) s.polish += 1; });
    if (relics.has('monitor') && o.brief && o.brief.hidden) rowOut.forEach(s => { if (s) s.polish += 1; });
    if (o.studioTest && relics.has('website')) rowOut.forEach(s => { if (s) s.polish += 2; });
    let best = null;
    if (o.brief) {
      for (let r = 0; r < R; r++) {
        const g = gradeShot(o.brief, rowOut[r], relics);
        g.row = r;
        if (!best || (g.pass && !best.pass) || (g.pass === best.pass && g.score > best.score)) best = g;
      }
    }
    return { cells, streams, sigs, rowOut, hours, colRam, ramPeak, best, R, C };
  }

  /* ================================================================
   * 7. briefs, grading, notes
   * ================================================================ */
  function polishForGrade(p) {
    p = Math.max(0, p);
    const cap = CONFIG.polishSoftCap;
    if (p <= cap) return p;
    return cap + (p - cap) * CONFIG.polishSoftRate;
  }
  function gradeShot(brief, s, relics) {
    const out = { pass: false, missing: [], stars: 0, polish: 0, gradePolish: 0, pts: 0, score: -999, grade: 'F', el: brief.hero, dead: false };
    if (!s) { out.missing = ['nostream']; return out; }
    if (s.dead) { out.dead = true; out.missing = ['dead']; return out; }
    out.stars = streamStars(s, relics, brief.hero);
    out.polish = Math.max(0, s.polish);
    // Polish diminishing returns: full value up to the soft cap, half per point
    // beyond it. Requirements and the UI read the raw polish; only the letter
    // grade uses gradePolish.
    out.gradePolish = round1(polishForGrade(out.polish));
    const reqs = brief.reqs.concat(brief.revealed || []);
    for (const q of reqs) { if (!REQS[q.id].test(s, q.n)) out.missing.push(q.id); }
    const heroOk = out.stars >= brief.minStars;
    if (!heroOk) out.missing.unshift('hero');
    out.pass = out.missing.length === 0;
    out.pts = Math.max(0, (out.stars - brief.minStars) * 2 + out.gradePolish);
    out.score = (out.pass ? 1000 : 0) + out.stars * 10 + out.polish - out.missing.length * 30;
    if (!out.pass) out.grade = 'F';
    else if (out.pts >= CONFIG.gradePts.S) out.grade = 'S';
    else if (out.pts >= CONFIG.gradePts.A) out.grade = 'A';
    else if (out.pts >= CONFIG.gradePts.B) out.grade = 'B';
    else out.grade = 'C';
    return out;
  }

  const CLIENTS = STORY.CLIENTS;
  const STUDIOS = STORY.STUDIOS;

  function notesFor(brief, g, dailyIdx, rng) {
    // returns { lines:[{who, text(loc)}], changes:{...} }
    const client = brief.client ? CLIENTS[brief.client] : null;
    const studio = brief.studio ? STUDIOS[brief.studio] : null;
    const persona = client ? client.persona : (studio ? studio.persona : 'mentor');
    const lines = [];
    const changes = {};
    let choice = null;
    const NL = STORY.NOTE_LINES;
    if (g.dead) lines.push(pick(rng, NL.dead));
    else if (g.missing.includes('nostream')) lines.push(pick(rng, NL.nothing));
    else {
      for (const m of g.missing) {
        if (m === 'hero') lines.push(fmtLine(pick(rng, NL.weakHero), { el: ELEMENTS[brief.hero].name, n: brief.minStars }));
        else if (REQS[m]) {
          const rq = (brief.reqs.concat(brief.revealed || [])).find(x => x.id === m) || { id: m };
          lines.push(fmtLine(pick(rng, NL.missing), { req: reqLoc(rq) }));
        }
      }
    }
    // persona twists (only once each)
    if (dailyIdx === 0 && !brief.twisted) {
      if (persona === 'bigger') {
        brief.minStars = Math.min(5, brief.minStars + 1); brief.twisted = true;
        lines.push(fmtLine(pick(rng, NL.bigger), { n: brief.minStars }));
        changes.minStars = brief.minStars;
      } else if (persona === 'secret' && brief.hidden && !brief.revealed.length) {
        brief.revealed.push(brief.hidden); brief.twisted = true;
        lines.push(fmtLine(pick(rng, NL.secret), { req: reqLoc(brief.hidden) }));
        changes.revealed = brief.hidden;
      } else if (persona === 'flipper') {
        const others = ELEMENT_IDS.filter(e => e !== brief.hero);
        const nh = brief.flipTo || pick(rng, others);
        changes.heroFrom = brief.hero;
        brief.hero = nh; brief.twisted = true;
        brief.minStars = Math.max(1, brief.minStars - 0.5);
        lines.push(fmtLine(pick(rng, NL.flip), { el: ELEMENTS[nh].name }));
        changes.hero = nh;
      } else if (persona === 'auteur') {
        if (brief.kind === 'test' || brief.noPolishTwist) {
          // Studio tests get the auteur's eye, not a moving target (P0-2).
          brief.twisted = true;
          lines.push(pick(rng, NL.auteurTest));
        } else {
          const pr = brief.reqs.find(q => q.id === 'polish');
          if (pr) { pr.n += 1; } else brief.reqs.push({ id: 'polish', n: 3 });
          brief.twisted = true;
          lines.push(pick(rng, NL.auteur));
          changes.polish = true;
        }
      } else if (persona === 'easy') {
        // Easy clients are a resource: deliver this week and they round up.
        brief.twisted = true;
        brief.payBoost = 1.2;
        lines.push(pick(rng, NL.easy));
        changes.payBoost = 1.2;
      } else if (persona === 'pincher') {
        // Tight budget is a trade-off, not a hidden −3h. The player picks one.
        brief.twisted = true;
        lines.push(pick(rng, NL.pincher));
        choice = {
          kind: 'pincher', defaultKey: 'pay',
          options: [
            { key: 'hours', label: NL.pincherHours },
            { key: 'pay', label: NL.pincherPay }
          ]
        };
        changes.noteChoice = 'pincher';
      }
    }
    if (g.pass && !lines.length) {
      if (g.grade === 'S') lines.push(pick(rng, NL.love));
      else lines.push(pick(rng, NL.ok));
    }
    if (!lines.length) lines.push(pick(rng, NL.ok));
    return { persona, lines, changes, choice };
  }
  function reqLoc(rq) {
    const d = REQS[rq.id];
    return { en: d.name.en.replace('{n}', rq.n), zh: d.name.zh.replace('{n}', rq.n) };
  }
  function fmtLine(line, vars) {
    const out = {};
    for (const l of LANGS) {
      out[l] = line[l].replace(/\{(\w+)\}/g, (m, k) => vars[k] == null ? m : (typeof vars[k] === 'object' ? vars[k][l] : String(vars[k])));
    }
    return out;
  }

  /* ================================================================
   * 8. job / board generation
   * ================================================================ */
  const REQ_POOL = ['tex', 'lit', 'final', 'night', 'grain', 'smoke', 'env', 'plate', 'stylized'];

  /* Which requirements can a deck actually satisfy?
   * Used to keep the “gig that matches your best element” doable (P0-1) and to
   * label shop courses that unlock a missing requirement. Deliberately a bit
   * conservative: it assumes budget-free layout but respects the column count. */
  const CHAIN_STEPS = {
    fire: ['pyrosrc', 'pyro', 'turb', 'upres'],
    water: ['flipsrc', 'flip', 'white', 'mesher'],
    destr: ['fracture', 'rbd', 'debris', 'dust'],
    magic: ['popsrc', 'pop', 'trails', 'glow'],
    creature: ['rig', 'animate|mocap', 'muscle|vellum', 'groom']
  };
  const REQ_ENABLERS = ['moon', 'lens', 'toon', 'plateint', 'terrain'];
  const NODE_UNLOCKS = { moon: ['night'], lens: ['grain'], toon: ['stylized'], plateint: ['plate'], terrain: ['env'], dustpass: ['smoke'] };

  function deckTypes(cards) {
    const t = new Set();
    for (const c of cards || []) for (const p of cardParts(c)) t.add(p);
    return t;
  }
  const hasAnyType = (types, ids) => ids.some(id => types.has(id));
  function deckChainStep(types, el) {
    const steps = CHAIN_STEPS[el];
    if (!steps) return 0;
    if (el === 'creature' && !types.has('sculpt')) return 0; // Rig needs organic geo
    let n = 0;
    for (const s of steps) {
      if (s.split('|').some(a => types.has(a))) n += 1;
      else break;
    }
    return n;
  }
  function deckCapabilities(cards, hw, relics) {
    const types = deckTypes(cards);
    const rel = relics instanceof Set ? relics : new Set(relics || []);
    const cols = (hw && hw.cols) || CONFIG.startCols;
    const hasGeo = hasAnyType(types, ['box', 'sculpt', 'hardsurf', 'terrain', 'scan']);
    const canLit = hasAnyType(types, ['light', 'threept', 'hdri', 'moon', 'firelight', 'pathtrace']);
    const canFinal = hasAnyType(types, ['comp', 'plateint', 'grade', 'lens', 'haze', 'glow']);
    const canTex = hasAnyType(types, ['shader', 'paint', 'skin', 'metal', 'toon', 'scan']);
    const canMerge = types.has('merge');
    const plateRow = types.has('plate') && types.has('plateint') && canMerge;
    const fireSmoke = types.has('turb') && types.has('pyrosrc') && types.has('pyro');
    const destrSmoke = types.has('dust') && types.has('fracture') && types.has('rbd') && types.has('debris');
    const reqs = {
      tex: canTex && hasGeo,
      lit: canLit && hasGeo,
      final: canLit && canFinal,
      plate: plateRow,
      night: types.has('moon'),
      env: types.has('terrain') && canMerge,
      stylized: types.has('toon'),
      grain: types.has('lens'),
      smoke: fireSmoke || destrSmoke || (types.has('dustpass') && hasGeo)
    };
    const chain = {};
    for (const el of ELEMENT_IDS) chain[el] = deckChainStep(types, el);
    const rows = (hw && hw.rows) || CONFIG.startRows;
    const caps = { types, reqs, chain, polish: 0, maxStars: {}, cols, rows, canLit, canFinal, relics: rel };
    for (const el of ELEMENT_IDS) caps.maxStars[el] = deckStarsFor(caps, el, []);
    caps.polish = Math.max.apply(null, ELEMENT_IDS.map(el => deckPolishFor(caps, el, [])));
    reqs.polish = caps.polish; // numeric: how much polish the deck can put on one row
    return caps;
  }
  /* approximate polish the deck can put on one finished hero row (conservative) */
  function deckPolishFor(caps, el, reqs) {
    if (!caps.canLit || !caps.canFinal) return 0;
    const types = caps.types;
    const ids = (reqs || []).map(q => q.id);
    const scanSource = types.has('scan') && el !== 'creature' && !ids.includes('stylized');
    let p = scanSource ? 1 : 0; // Scan comes pre-textured, +1 polish
    if (!scanSource) {
      // a surfacing slot exists; take the best match polish
      let bestSurf = 0;
      if (types.has('toon')) bestSurf = 1;
      if (types.has('paint') && (types.has('terrain') || types.has('sculpt'))) bestSurf = Math.max(bestSurf, 1);
      if (types.has('skin') && types.has('sculpt')) bestSurf = Math.max(bestSurf, 1);
      if (types.has('metal') && (types.has('hardsurf') || types.has('scan'))) bestSurf = Math.max(bestSurf, 1);
      p += bestSurf;
    }
    let bestLight = 0;
    if (types.has('pathtrace')) bestLight = 2;
    if (types.has('hdri') && types.has('terrain')) bestLight = Math.max(bestLight, 2);
    if (types.has('threept') || types.has('firelight')) bestLight = Math.max(bestLight, 1);
    if (ids.includes('night')) bestLight = 0; // Moonlight occupies the light slot
    p += bestLight;
    let bestComp = 0;
    if (types.has('grade')) bestComp = 1;
    if (types.has('lens')) bestComp = 1;
    if (ids.includes('grain')) bestComp = Math.min(bestComp, 1); // Lens is the comp node
    if (ids.includes('plate') && !ids.includes('grain')) bestComp = 0; // Plate Integrate occupies it
    p += bestComp;
    return p;
  }
  /* base columns for source + texture + light + comp */
  function deckBaseCols(caps, el, reqs) {
    // Scan is both a source and textured; only a non-creature chain can use it.
    const scanSource = caps.types.has('scan') && el !== 'creature';
    let base = scanSource ? 3 : 4;
    // An Environment or Stylized requirement still needs a separate source/surfacing
    // card, so Scan's column saving is gone.
    if (scanSource && reqs.some(q => q.id === 'env' || q.id === 'stylized')) base = 4;
    return base;
  }
  /* how deep the hero chain has to be for smoke, if there is no Dust Pass */
  function smokeMinStep(caps, el) {
    if (caps.types.has('dustpass')) return 0; // standalone node, no chain depth needed
    if (el === 'fire' && caps.chain.fire >= 3) return 3; // Turbulence
    if (el === 'destr' && caps.chain.destr >= 4) return 4; // Dust
    return Infinity;
  }
  /* columns left for hero-chain steps once base pipeline + extra requirements are placed */
  function deckRowFit(caps, el, reqs) {
    let extra = 0;
    const ids = reqs.map(q => q.id);
    const hasPlate = ids.includes('plate');
    const hasEnv = ids.includes('env');
    if (hasPlate || hasEnv) extra += 1; // one Merge column can take both side rows
    if (hasPlate && ids.includes('grain')) extra += 1; // need both Plate Integrate and Lens
    for (const id of ids) {
      if (id === 'smoke') {
        const ms = smokeMinStep(caps, el);
        if (ms === 0) extra += 1; // Dust Pass column
        else if (!isFinite(ms)) extra += 99; // no way to make smoke with this hero
      }
    }
    return Math.max(0, caps.cols - deckBaseCols(caps, el, reqs) - extra);
  }
  /* rough minimum hours for a layout reaching the given chain depth */
  function deckMinHours(caps, el, reqs, step) {
    const types = caps.types;
    const ids = reqs.map(q => q.id);
    const creature = el === 'creature';
    const needEnv = ids.includes('env'), needPlate = ids.includes('plate'),
      needGrain = ids.includes('grain'), needNight = ids.includes('night'), needSmoke = ids.includes('smoke');
    let h = 0;
    const needStyl = ids.includes('stylized');
    if (creature) h += 2 + 1; // Sculpt + shader
    else if (needEnv) h += 1 + 1; // Terrain can't be the main source: Box + shader
    else if (types.has('scan') && !needStyl) h += 3; // Scan is source and texture in one card
    else h += 1 + 1; // Box + shader
    for (let s = 1; s <= step; s++) {
      const cands = NODE_IDS.filter(id => {
        const hd = NODE_DEFS[id].hero;
        return hd && hd.el === el && hd.step === s && types.has(id);
      });
      if (!cands.length) return Infinity;
      h += Math.min.apply(null, cands.map(id => NODE_DEFS[id].h));
    }
    if (needEnv) h += 2; // Terrain side row
    if (needEnv || needPlate) h += 1; // one Merge can pull in both side rows
    h += 1; // any light
    if (needPlate) { h += 2; if (needGrain) h += 1; } // Plate Integrate (+ Lens)
    else h += 1; // comp (or Lens)
    const polishReq = reqs.find(q => q.id === 'polish');
    if (polishReq) {
      // budget for turning the light/comp slots into polish nodes (Path Tracer is pricey)
      if (polishReq.n >= 3) h += 4;
      else if (polishReq.n >= 2) h += 1;
    }
    if (needSmoke && types.has('dustpass')) h += 1;
    return h;
  }
  /* guaranteed hero stars for a given list of requirements: chain depth that fits,
   * capped by the pipeline. Sim luck and relics can only push this higher. */
  function deckStarsFor(caps, el, reqs) {
    let step = Math.min(caps.chain[el] || 0, deckRowFit(caps, el, reqs));
    if (reqs.some(q => q.id === 'smoke')) {
      const ms = smokeMinStep(caps, el);
      if (!isFinite(ms) || step < ms) step = 0;
    }
    let cap = CONFIG.maxStars;
    if (!caps.canLit) cap = CONFIG.capUnlit;
    else if (!caps.canFinal) cap = CONFIG.capNoComp;
    return round1(Math.max(0, Math.min(step, cap)));
  }

  /* Rewrite the “matches your best element” gig so every extra requirement can
   * be met by the current deck and the star bar can actually be reached. */
  function makeGigFeasible(gig, week, caps, rng) {
    const mandatory = [];
    if (caps.reqs.lit) mandatory.push('lit');
    if (week >= 2 && caps.reqs.tex) mandatory.push('tex');
    if (week >= 3 && caps.reqs.final) mandatory.push('final');
    const isPolish = q => q.id === 'polish';
    const isMandatory = q => mandatory.includes(q.id);
    const extras = gig.reqs.filter(q => !isMandatory(q) && !isPolish(q));
    const kept = extras.filter(q => caps.reqs[q.id]);
    const fill = shuffle(rng, REQ_POOL.filter(id => caps.reqs[id] && !mandatory.includes(id) && (!gig.hidden || id !== gig.hidden.id) && !kept.some(q => q.id === id)));
    while (kept.length < extras.length && fill.length) kept.push({ id: fill.shift() });
    // If the grid is too narrow or short for the extra columns/rows plus a hero
    // step, drop the hungry extras rather than promise something undoable.
    const costly = q => q.id === 'plate' || q.id === 'smoke';
    const probe = () => kept.concat(gig.hidden ? [gig.hidden] : []);
    const supportRows = list => {
      let r = 0;
      // Plate and Environment each need their own side row; one Merge can pull
      // both in, so env + plate needs 3 rows (main + 2 support).
      if (list.some(q => q.id === 'plate')) r += 1;
      if (list.some(q => q.id === 'env')) r += 1;
      return r;
    };
    const budget = CONFIG.baseHours + (gig.hoursMod || 0);
    const infeasible = () => deckStarsFor(caps, gig.hero, probe()) < 1 ||
      supportRows(probe()) > caps.rows - 1 ||
      deckMinHours(caps, gig.hero, probe(), 1) > budget;
    while (kept.length && infeasible()) {
      let idx = kept.findIndex(q => q.id === 'plate');
      if (idx < 0) idx = kept.findIndex(q => q.id === 'env');
      if (idx < 0) idx = kept.findIndex(costly);
      if (idx < 0) break;
      kept.splice(idx, 1);
    }
    let out = mandatory.map(id => ({ id })).concat(kept.map(q => ({ id: q.id })));
    if (gig.hidden) {
      // Hidden requirements still have to be satisfiable — and fit in the grid.
      const hiddenProbe = out.concat([gig.hidden]);
      const bad = !caps.reqs[gig.hidden.id] ||
        deckStarsFor(caps, gig.hero, hiddenProbe) < 1 ||
        supportRows(hiddenProbe) > caps.rows - 1 ||
        deckMinHours(caps, gig.hero, hiddenProbe, 1) > budget;
      if (bad) {
        const pool = REQ_POOL.filter(id => {
          if (!caps.reqs[id] || out.some(q => q.id === id) || id === 'plate' || id === 'smoke') return false;
          const cand = out.concat([{ id }]);
          return supportRows(cand) <= caps.rows - 1 &&
            deckStarsFor(caps, gig.hero, cand) >= 1 &&
            deckMinHours(caps, gig.hero, cand, 1) <= budget;
        });
        gig.hidden = pool.length ? { id: pick(rng, pool) } : null;
      }
    }
    const pr = gig.reqs.find(isPolish);
    if (pr) {
      const isAuteur = !!(gig.client && CLIENTS[gig.client] && CLIENTS[gig.client].persona === 'auteur');
      const heroPolish = deckPolishFor(caps, gig.hero, out.concat(gig.hidden ? [gig.hidden] : []));
      // An auteur note adds +1 polish after the first dailies; leave room for it.
      const cap = Math.max(0, heroPolish - (isAuteur ? 1 : 0));
      const n = Math.min(pr.n, cap);
      if (n > 0) out.push({ id: 'polish', n });
      else if (isAuteur) gig.noPolishTwist = true;
    }
    gig.reqs = out;
    const allReqs = out.concat(gig.hidden ? [gig.hidden] : []);
    let reachable = deckStarsFor(caps, gig.hero, allReqs);
    while (reachable >= 1 && deckMinHours(caps, gig.hero, allReqs, reachable) > budget) reachable -= 1;
    if (gig.minStars > reachable) gig.minStars = Math.max(1, round1(reachable));
    if (gig.flipTo) {
      const flipStars = Math.max(1, gig.minStars - 0.5);
      const alt = ELEMENT_IDS.filter(e => e !== gig.hero &&
        deckStarsFor(caps, e, allReqs) >= flipStars &&
        deckMinHours(caps, e, allReqs, Math.max(1, Math.floor(flipStars))) <= budget);
      if (alt.length && !alt.includes(gig.flipTo)) gig.flipTo = pick(rng, alt);
    }
    return gig;
  }
  /* A flipper's new hero should be something the player can actually pivot to:
   * prefer the deck's second-strongest element, so owning a second chain turns
   * the twist from a punishment into a plan. */
  function flipTargetFor(caps, gig, rng) {
    const flipStars = Math.max(1, gig.minStars - 0.5);
    const allReqs = gig.reqs.concat(gig.hidden ? [gig.hidden] : []);
    const budget = CONFIG.baseHours + (gig.hoursMod || 0);
    const ranked = ELEMENT_IDS.slice().sort((a, b) => (caps.maxStars[b] || 0) - (caps.maxStars[a] || 0));
    const ok = e => e !== gig.hero && e !== gig.flipFrom &&
      deckStarsFor(caps, e, allReqs) >= flipStars &&
      deckMinHours(caps, e, allReqs, Math.max(1, Math.floor(flipStars))) <= budget;
    let target = ranked[1] || ranked[0];
    if (!ok(target)) target = ranked.find(ok);
    return target || pick(rng, ELEMENT_IDS.filter(e => e !== gig.hero));
  }
  function genGig(rng, week, clientId, bg, caps) {
    const cl = CLIENTS[clientId];
    const hero = (cl.heroes && rng() < 0.7) ? pick(rng, cl.heroes) : pick(rng, ELEMENT_IDS);
    const minStars = clamp(round1(1 + week * 0.24 + (rng() < 0.3 ? 0.5 : 0)), 1, 4.5);
    const reqs = [{ id: 'lit' }];
    if (week >= 2) reqs.push({ id: 'tex' });
    if (week >= 3) reqs.push({ id: 'final' });
    const extraN = week <= 2 ? 0 : (week <= 6 ? 1 : 2);
    const pool = shuffle(rng, (cl.reqs || REQ_POOL).filter(x => !reqs.some(q => q.id === x)));
    for (let i = 0; i < extraN && i < pool.length; i++) reqs.push({ id: pool[i] });
    if (cl.persona === 'auteur') reqs.push({ id: 'polish', n: 2 + Math.floor(week / 4) });
    else if (week >= 7 && rng() < 0.5) reqs.push({ id: 'polish', n: 2 });
    // Secret requirements are only drawn from what this deck can actually
    // satisfy — a legal surprise, not an impossible one.
    let hidden = null;
    if (cl.persona === 'secret') {
      const base = REQ_POOL.filter(x => !reqs.some(q => q.id === x) && x !== 'plate');
      const deckOk = caps ? base.filter(id => caps.reqs[id]) : base;
      hidden = { id: pick(rng, deckOk.length ? deckOk : base) };
    }
    let pay = Math.round((CONFIG.gigPay.base + CONFIG.gigPay.perWeek * week) * (cl.payMul || 1) * (0.9 + rng() * 0.25) / 10) * 10;
    const hoursMod = cl.hoursMod || 0;
    const nda = cl.nda === true ? true : (cl.nda === false ? false : rng() < 0.3);
    const noun = pick(rng, ELEMENTS[hero].noun);
    return {
      kind: 'gig', client: clientId, hero, minStars, reqs, hidden, revealed: [], pay, nda, hoursMod,
      title: noun, flipTo: cl.persona === 'flipper' ? pick(rng, ELEMENT_IDS.filter(e => e !== hero)) : null
    };
  }
  function genTest(rng, studioId, week) {
    const st = STUDIOS[studioId];
    const hero = st.heroes ? pick(rng, st.heroes) : pick(rng, ELEMENT_IDS);
    return {
      kind: 'test', studio: studioId, hero: null, heroChoices: st.heroChoice ? ELEMENT_IDS.slice() : null,
      minStars: st.minStars, reqs: st.reqs.map(q => Object.assign({}, q)), hidden: st.hidden ? Object.assign({}, st.hidden) : null,
      revealed: [], pay: 0, nda: false, hoursMod: st.hoursMod || 0, title: st.shotName, defaultHero: hero
    };
  }
  function genPortfolio() {
    return { kind: 'portfolio', hero: null, heroChoices: ELEMENT_IDS.slice(), minStars: 1, reqs: [{ id: 'lit' }, { id: 'final' }], revealed: [], pay: 0, nda: false, hoursMod: 2, title: loc('Personal Shot', '个人作品') };
  }
  function reelGate(studioId) { return STUDIOS[studioId].gate; }
  function checkGate(gate, reel, opts) {
    const eligible = reel.filter(s => !s.nda && !s.ng);
    const res = { ok: true, lines: [] };
    const good = eligible.filter(s => s.stars >= gate.stars);
    // The shot you are about to make counts towards the gate (P0-2): you still
    // have to pass the test, but you do not need an extra portfolio week for it.
    const ts = opts && opts.testShot;
    const testGood = !!(ts && ts.stars >= gate.stars);
    const countHave = good.length + (testGood ? 1 : 0);
    const okCount = countHave >= gate.count;
    res.lines.push({ ok: okCount, key: 'gate.count', vars: { n: gate.count, s: gate.stars, have: countHave } });
    if (!okCount) res.ok = false;
    if (gate.distinct) {
      const els = new Set(good.map(s => s.el));
      if (testGood) {
        if (ts.heroChoices) { if (els.size < ELEMENT_IDS.length) els.add('__test'); }
        else if (ts.el) els.add(ts.el);
      }
      const d = Math.min(els.size, ELEMENT_IDS.length);
      const ok = d >= gate.distinct;
      res.lines.push({ ok, key: 'gate.distinct', vars: { n: gate.distinct, have: d } });
      if (!ok) res.ok = false;
    }
    if (gate.top) {
      const ok = eligible.some(s => s.stars >= gate.top) || !!(ts && ts.stars >= gate.top);
      res.lines.push({ ok, key: 'gate.top', vars: { s: gate.top } });
      if (!ok) res.ok = false;
    }
    res.testIncluded = !!testGood;
    return res;
  }

  /* ================================================================
   * 9. sim (live solver)
   * ================================================================ */
  function simParams(card, opts) {
    const S = CONFIG.solver;
    const q = card.q || 1;
    let inst = S.instBase * S.qInst[q];
    let accel = S.instAccel * S.qInst[q];
    if (opts.collision) { inst *= S.collisionMul; accel *= S.collisionMul; }
    if (opts.guru) { inst *= S.guruMul; accel *= S.guruMul; }
    if (opts.wedge) { inst *= 0.92; accel *= 0.92; }
    if (opts.anim) { inst *= S.animMul; accel *= S.animMul; }
    if (opts.tutorial) { inst *= 0.55; accel *= 0.55; }
    const el = NODE_DEFS[cardParts(card).find(p => NODE_DEFS[p].solver)].hero.el;
    return { detail: S.detailRate * S.qDetail[q], inst, accel, frames: S.frames, el };
  }
  function simInit(params, seed) {
    const S = CONFIG.solver;
    const brng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const bandShift = Math.round((brng() * 2 - 1) * S.bands.jitter);
    return { f: 0, detail: 0, inst: 0, diverged: false, done: false, params, seed: seed >>> 0, history: [], bandShift };
  }
  /* The player never sees the instability number — only these three bands.
   * bandShift is drawn per sim so the band edges move around. */
  function simBand(inst, bandShift) {
    const B = CONFIG.solver.bands;
    const s = bandShift || 0;
    if (inst >= B.danger + s) return 'danger';
    if (inst >= B.warn + s) return 'warn';
    return 'steady';
  }
  function simSpikeChance(f) {
    const S = CONFIG.solver;
    return Math.min(0.5, S.spikeBase + S.spikePerFrame * f);
  }
  function simStep(st, rng) {
    if (st.done) return st;
    const p = st.params;
    const S = CONFIG.solver;
    st.f += 1;
    // detail growth decays towards the end of the run: the first frames are
    // worth more than the last ones, so “just one more frame” has a cost.
    const decay = Math.max(0, 1 - S.detailDecay * st.f / p.frames);
    st.detail += p.detail * decay * (0.85 + rng() * 0.3);
    let g = (p.inst + p.accel * st.f) * (0.55 + rng() * 0.9);
    if (rng() < simSpikeChance(st.f)) g *= S.spikeMul; // spikes, increasing with frame
    st.inst += g;
    st.history.push(Math.round(st.inst));
    if (st.inst >= 100) { st.diverged = true; st.done = true; }
    else if (st.f >= p.frames) st.done = true;
    return st;
  }
  function simBonus(detail) {
    const th = CONFIG.solver.thresholds;
    let b = 0;
    for (const x of th) if (detail >= x) b += 0.5;
    return b;
  }
  function simPredict(params, seed) {
    // expected divergence frame (no noise) for the Wedge relic. With a seed the
    // prediction is off by up to ±3 frames, like a human eyeballing the graph.
    let inst = 0;
    for (let f = 1; f <= params.frames; f++) {
      inst += (params.inst + params.accel * f);
      if (inst >= 100) {
        if (seed == null) return f;
        const r = mulberry32((seed >>> 0) ^ 0x51ed270b)();
        const err = Math.round((r * 2 - 1) * 3);
        return clamp(f + err, 3, params.frames);
      }
    }
    return null;
  }

  /* ================================================================
   * 10. Game
   * ================================================================ */
  class Game {
    constructor(seed) {
      this.seed = (seed == null ? Math.floor(Math.random() * 1e9) : seed) >>> 0;
      this.rng = mulberry32(this.seed);
      this.phase = 'title';
      this.week = 0;
      this.cash = CONFIG.startCash;
      this.cards = [];
      this.relics = [];
      this.hw = { cols: CONFIG.startCols, rows: CONFIG.startRows, ram: CONFIG.startRam, cpuLvl: 0, gpuLvl: 0 };
      this.reel = [];
      this.flags = {};
      this.history = [];
      this.job = null;
      this.board = null;
      this.shop = null;
      this.inbox = [];
      this.bonusHoursNext = 0;
      this.ending = null;
      this.stats = { jobs: 0, sims: 0, diverged: 0, earned: 0, rentPaid: 0, best: 0 };
      this.bg = null;
      this.offers = [];
    }
    relicSet() { return new Set(this.relics); }
    hasRelic(id) { return this.relics.includes(id); }
    rentDue() { return CONFIG.rent + CONFIG.catFood + (this.hasRelic('caffeine') ? 25 : 0) + (this.flags.rentHike ? 60 : 0); }

    start(bgId) {
      const bg = BACKGROUNDS[bgId];
      this.bg = bgId;
      this.cards = BASICS.concat(bg.cards).map(t => makeCard(t));
      this.relics = [bg.relic];
      this.cash = CONFIG.startCash + (bg.cash || 0);
      this.week = 1;
      this.beginWeek();
      return this;
    }

    /* ---------- week flow ---------- */
    beginWeek() {
      this.phase = 'inbox';
      this.inbox = STORY.inboxFor(this, this.rng);
      this.board = this.makeBoard();
    }
    resolveEvent(msgIdx, choiceIdx) {
      const m = this.inbox[msgIdx];
      if (!m || !m.choices || m.resolved != null) return { ok: false };
      const ch = m.choices[choiceIdx];
      if (ch.cost && this.cash < ch.cost) return { ok: false, reason: 'err.cash' };
      m.resolved = choiceIdx;
      const out = ch.effect ? ch.effect(this) || {} : {};
      m.result = out.text || ch.result || null;
      this.log('event', m.id + ':' + choiceIdx);
      return { ok: true, result: m.result };
    }
    inboxBlocking() { return this.inbox.some(m => m.choices && m.resolved == null); }
    toBoard() { if (this.inboxBlocking()) return false; this.phase = 'board'; return true; }

    makeBoard() {
      const rng = mulberry32(this.seed ^ (this.week * 7919));
      const pool = shuffle(rng, Object.keys(CLIENTS).filter(id => !CLIENTS[id].minWeek || CLIENTS[id].minWeek <= this.week));
      const caps = deckCapabilities(this.cards, this.hw, this.relicSet());
      const gigs = [];
      const n = this.week === 1 ? 1 : 3;
      for (let i = 0; i < n; i++) gigs.push(genGig(rng, this.week, this.week === 1 ? 'rumble' : pool[i % pool.length], this.bg, caps));
      // Flippers swing towards the second-strongest element in the deck.
      for (const gg of gigs) {
        const cl = CLIENTS[gg.client];
        if (cl && cl.persona === 'flipper') gg.flipTo = flipTargetFor(caps, gg, rng);
      }
      // one gig always speaks to what you're good at — and it must be doable
      const fav = this.favoriteElement();
      if (n > 1 && fav) {
        let gi = gigs.findIndex(gg => gg.hero === fav);
        if (gi < 0) {
          gi = Math.floor(rng() * n);
          gigs[gi].hero = fav; gigs[gi].title = pick(rng, ELEMENTS[fav].noun);
          if (gigs[gi].flipTo === fav) gigs[gi].flipTo = flipTargetFor(caps, gigs[gi], rng);
        }
        makeGigFeasible(gigs[gi], this.week, caps, rng);
      }
      if (this.week === 1) { gigs[0].minStars = 1; gigs[0].reqs = [{ id: 'lit' }]; gigs[0].hero = BACKGROUNDS[this.bg].el || 'destr'; gigs[0].tutorial = true; gigs[0].title = ELEMENTS[gigs[0].hero].noun[0]; gigs[0].pay = 520; gigs[0].nda = false; }
      const board = { gigs, portfolio: this.week > 1 ? genPortfolio() : null, test: null };
      const tw = CONFIG.testWeeks[this.week];
      if (tw) {
        board.test = genTest(rng, tw, this.week);
        const ts = board.test;
        board.testGate = checkGate(reelGate(tw), this.reel, {
          testShot: { stars: ts.minStars, el: ts.heroChoices ? null : ts.hero, heroChoices: !!ts.heroChoices }
        });
      }
      return board;
    }

    favoriteElement() {
      const score = {};
      for (const c of this.cards) for (const p of cardParts(c)) { const h = NODE_DEFS[p].hero; if (h) score[h.el] = (score[h.el] || 0) + 1; }
      for (const r of this.relics) { const rl = RELICS[r]; if (rl && rl.el) score[rl.el] = (score[rl.el] || 0) + 2; }
      let best = null, bv = 0;
      for (const e in score) if (score[e] > bv) { bv = score[e]; best = e; }
      return best;
    }
    chooseJob(kind, idx, heroChoice) {
      if (this.phase !== 'board') return { ok: false };
      let brief;
      if (kind === 'gig') brief = this.board.gigs[idx];
      else if (kind === 'portfolio') brief = this.board.portfolio;
      else if (kind === 'test') { if (!this.board.testGate.ok) return { ok: false, reason: 'err.gate' }; brief = this.board.test; }
      if (!brief) return { ok: false };
      brief = JSON.parse(JSON.stringify(brief));
      if (brief.heroChoices) brief.hero = heroChoice || brief.defaultHero || brief.heroChoices[0];
      if (!brief.hero) brief.hero = 'fire';
      if (this.hasRelic('monitor') && brief.hidden) { brief.revealed.push(brief.hidden); brief.hiddenSeen = true; }
      const hours = CONFIG.baseHours + (brief.hoursMod || 0) + this.bonusHoursNext + (this.hasRelic('caffeine') ? 5 : 0) + (this.hasRelic('backup') ? 2 : 0) + (this.flags.hoursPenalty || 0);
      this.bonusHoursNext = 0;
      this.flags.hoursPenalty = 0;
      let dailies = CONFIG.dailies + (this.hasRelic('notebook') ? 1 : 0) + (brief.kind === 'test' && this.hasRelic('confidence') ? 1 : 0);
      this.job = {
        brief, grid: emptyGrid(this.hw.rows, this.hw.cols),
        hoursTotal: hours, hoursLeft: hours, dailiesMax: dailies, dailiesUsed: 0,
        farmBought: 0, last: null, notes: [], pipUsed: false, results: [], seedBase: Math.floor(this.rng() * 1e9)
      };
      this.phase = 'work';
      this.log('job', brief.kind + ':' + (brief.client || brief.studio || '') + ':' + brief.hero);
      return { ok: true };
    }

    /* ---------- grid editing ---------- */
    placedUids() {
      const s = new Set();
      if (!this.job) return s;
      for (const row of this.job.grid) for (const c of row) if (c) s.add(c.uid);
      return s;
    }
    freeCards() { const used = this.placedUids(); return this.cards.filter(c => !used.has(c.uid)); }
    place(uid, r, c) {
      const j = this.job; if (!j) return { ok: false };
      if (r < 0 || r >= j.grid.length || c < 0 || c >= j.grid[0].length) return { ok: false };
      const card = this.cards.find(x => x.uid === uid);
      if (!card) return { ok: false };
      // move if already placed
      for (const row of j.grid) for (let i = 0; i < row.length; i++) if (row[i] && row[i].uid === uid) row[i] = null;
      j.grid[r][c] = card;
      return { ok: true };
    }
    remove(r, c) { if (!this.job) return; this.job.grid[r][c] = null; }
    resim(uid) { const card = this.cards.find(x => x.uid === uid); if (card) card.nonce = (card.nonce || 0) + 1; }
    setQuality(uid, q) {
      const card = this.cards.find(x => x.uid === uid);
      if (!card || !cardHasQuality(card)) return false;
      card.q = clamp(q, 1, 3); return true;
    }

    preview() {
      const j = this.job;
      const relics = this.relicSet();
      const base = { relics, brief: j.brief, studioTest: j.brief.kind === 'test' };
      const ev0 = evaluate(j.grid, base);
      const cached = {};
      let cost = 0;
      for (let r = 0; r < ev0.R; r++) for (let c = 0; c < ev0.C; c++) {
        const card = j.grid[r][c]; if (!card) continue;
        const key = r + ',' + c;
        const isCached = !!(j.last && j.last.sigs[r] && j.last.sigs[r][c] === ev0.sigs[r][c] && j.last.okKeys[key]);
        cached[key] = isCached;
        if (!isCached) cost += cardHours(card, relics);
      }
      const solver = {}, fails = {};
      if (j.last) {
        for (const k in cached) if (cached[k]) {
          if (j.last.solver[k]) solver[k] = j.last.solver[k];
          if (j.last.fails[k]) fails[k] = true;
        }
      }
      const ev = evaluate(j.grid, Object.assign({}, base, { solverResults: solver, fails }));
      ev.cached = cached;
      ev.cost = cost;
      ev.ramMax = this.hw.ram;
      ev.oom = ev.ramPeak > this.hw.ram;
      return ev;
    }
    reuseSolver(ev) {
      const j = this.job; const out = {};
      if (!j.last) return out;
      for (const k in j.last.solver) out[k] = j.last.solver[k];
      return out;
    }
    reuseFails() { return this.job.last ? Object.assign({}, this.job.last.fails) : {}; }

    farmPrice() {
      const p = CONFIG.farmBasePrice + CONFIG.farmPriceStep * this.job.farmBought;
      return this.hasRelic('farm') ? Math.round(p / 2) : p;
    }
    rentFarm() {
      const j = this.job;
      if (j.farmBought >= CONFIG.farmMaxPerJob) return { ok: false, reason: 'err.farmMax' };
      const p = this.farmPrice();
      if (this.cash < p) return { ok: false, reason: 'err.cash' };
      const h = CONFIG.farmHours + (this.hasRelic('farm') ? 1 : 0);
      this.cash -= p; j.farmBought += 1; j.hoursLeft += h; j.hoursTotal += h;
      this.log('farm', p);
      return { ok: true, price: p };
    }

    /* Cook: step 1 — plan (which solvers need a live sim) */
    prepareCook() {
      const j = this.job;
      if (!j) return { ok: false };
      // A note that asks the player to choose blocks the next cook; doing it
      // anyway falls back to the safe default (headless bots rely on this).
      if (j.pendingNote) this.resolveNote(j.pendingNote.defaultKey);
      if (j.dailiesUsed >= j.dailiesMax) return { ok: false, reason: 'err.noDailies' };
      const ev = this.preview();
      if (ev.oom) return { ok: false, reason: 'err.oom' };
      if (ev.cost > j.hoursLeft) return { ok: false, reason: 'err.hours' };
      const placed = j.grid.some(row => row.some(Boolean));
      if (!placed) return { ok: false, reason: 'err.empty' };
      const sims = [];
      for (let r = 0; r < ev.R; r++) for (let c = 0; c < ev.C; c++) {
        const card = j.grid[r][c]; if (!card) continue;
        const key = r + ',' + c;
        const cell = ev.cells[r][c];
        if (!isSolverCard(card) || ev.cached[key] || cell.status === 'err') continue;
        // solver only sims if its upstream would be valid: check that check passes
        const inStream = c > 0 ? ev.streams[r][c - 1] : null;
        const params = simParams(card, { collision: collisionNear(j.grid, r, c), guru: this.hasRelic('guru'), wedge: this.hasRelic('wedge'), anim: !!(inStream && inStream.anim), tutorial: !!j.brief.tutorial });
        const seed = (j.seedBase + j.dailiesUsed * 131 + r * 17 + c * 7) >>> 0;
        sims.push({ key, r, c, type: card.type, params, seed, predict: this.hasRelic('wedge') ? simPredict(params, seed) : null });
      }
      return { ok: true, sims, cost: ev.cost, ev };
    }

    /* Cook: step 2 — commit with sim outcomes {key:{detail, diverged, f}} */
    commitCook(outcomes) {
      const j = this.job;
      const plan = this.prepareCook();
      if (!plan.ok) return plan;
      outcomes = outcomes || {};
      const ev0 = plan.ev;
      const solver = this.reuseSolver();
      const fails = {};
      const rng = mulberry32(j.seedBase ^ (j.dailiesUsed + 1) * 2654435761);
      const fresh = [];
      for (const sim of plan.sims) {
        let o = outcomes[sim.key];
        if (!o) { // auto-run: cache at the safest good point (headless)
          const st = simInit(sim.params, sim.seed);
          const srng = mulberry32(sim.seed);
          while (!st.done && st.detail < 60) simStep(st, srng);
          o = { detail: st.detail, diverged: st.diverged, f: st.f };
        }
        solver[sim.key] = { bonus: o.diverged ? 0 : simBonus(o.detail), diverged: !!o.diverged, detail: o.detail, f: o.f };
        this.stats.sims += 1; if (o.diverged) this.stats.diverged += 1;
      }
      // drop solver entries for keys that no longer hold a solver
      for (const k in solver) { const [r, c] = k.split(',').map(Number); const cd = j.grid[r] && j.grid[r][c]; if (!cd || !isSolverCard(cd)) delete solver[k]; }
      // quality rolls
      const prevFails = j.last ? j.last.fails : {};
      for (let r = 0; r < ev0.R; r++) for (let c = 0; c < ev0.C; c++) {
        const card = j.grid[r][c]; if (!card) continue;
        const key = r + ',' + c;
        if (ev0.cached[key]) { if (prevFails[key]) fails[key] = true; continue; }
        const risk = cardRisk(card);
        if (risk > 0 && rng() < risk) {
          if (this.hasRelic('pip') && !j.pipUsed) { j.pipUsed = true; fresh.push({ key, pip: true }); continue; }
          fails[key] = true; fresh.push({ key, dept: cardDept(card) });
        }
      }
      const ev = evaluate(j.grid, { relics: this.relicSet(), brief: j.brief, studioTest: j.brief.kind === 'test', solverResults: solver, fails });
      // A failed model tier is now just a weaker take (no extra row crash), so
      // keep the field for the result UI but never null a row.
      const oomRow = null;
      const okKeys = {};
      for (let r = 0; r < ev.R; r++) for (let c = 0; c < ev.C; c++) if (ev.cells[r][c] && ev.cells[r][c].status === 'ok' && !ev.cells[r][c].empty && !(solver[r + ',' + c] && solver[r + ',' + c].diverged)) okKeys[r + ',' + c] = true;
      j.hoursLeft -= plan.cost;
      const g = ev.best;
      const notes = notesFor(j.brief, g, j.dailiesUsed, rng);
      j.dailiesUsed += 1;
      if (notes.choice) j.pendingNote = notes.choice;
      j.last = { sigs: ev.sigs, okKeys, solver, fails, grade: g, stream: g && ev.rowOut[g.row], ev, fresh, oomRow, notes, cost: plan.cost, cachedCount: Object.values(ev0.cached).filter(Boolean).length };
      // grade again after notes possibly changed the brief (twists apply to NEXT delivery)
      j.last.gradeAfter = gradeShot(j.brief, j.last.stream, this.relicSet());
      j.notes.push(notes);
      j.results.push({ grade: g.grade, stars: g.stars, polish: g.polish });
      return { ok: true, ev, grade: g, notes, fresh, oomRow, cost: plan.cost };
    }

    /* Resolve a note that offered the player a choice (pincher budget meeting).
     * The UI blocks cook/deliver until this is called; headless callers get the
     * safe default automatically. */
    resolveNote(key) {
      const j = this.job;
      if (!j || !j.pendingNote) return { ok: false };
      const ch = j.pendingNote;
      const opt = ch.options.find(o => o.key === key) || ch.options.find(o => o.key === ch.defaultKey) || ch.options[0];
      if (ch.kind === 'pincher') {
        if (opt.key === 'hours') {
          const before = j.hoursLeft;
          j.hoursLeft = Math.max(0, Math.round(j.hoursLeft * 0.8));
          j.brief.hoursCut = before - j.hoursLeft;
        } else {
          j.brief.payMulNote = 0.8;
        }
        j.brief.twistChoice = opt.key;
      }
      j.pendingNote = null;
      return { ok: true, key: opt.key };
    }
    canDeliver() { return !!(this.job && this.job.last && !this.job.pendingNote); }
    abandon() {
      const j = this.job; if (!j) return { ok: false };
      j.last = { stream: null, sigs: [], okKeys: {}, solver: {}, fails: {} };
      return this.deliver();
    }
    serialize() {
      const o = {};
      for (const k of ['seed', 'phase', 'week', 'cash', 'cards', 'relics', 'hw', 'reel', 'flags', 'history', 'job', 'board', 'shop', 'bonusHoursNext', 'ending', 'stats', 'bg', 'lastDelivery', 'lastRent']) o[k] = this[k];
      if (o.job && o.job.last) { o.job = Object.assign({}, o.job, { last: Object.assign({}, o.job.last, { ev: null }) }); }
      return JSON.stringify(o);
    }
    static restore(str) {
      const o = JSON.parse(str);
      const g = new Game(o.seed);
      Object.assign(g, o);
      g.rng = mulberry32((o.seed ^ (o.week * 7919) ^ (o.history.length * 31)) >>> 0);
      g.inbox = [];
      let max = 0;
      for (const c of g.cards) { const n = parseInt(String(c.uid).slice(1), 10); if (n > max) max = n; }
      if (UID <= max) UID = max + 1;
      if (g.job) {
        const byId = {}; g.cards.forEach(c => { byId[c.uid] = c; });
        g.job.grid = g.job.grid.map(row => row.map(c => (c && byId[c.uid]) || null));
      }
      return g;
    }
    deliver() {
      const j = this.job;
      if (!j || !j.last) return { ok: false };
      if (j.pendingNote) this.resolveNote(j.pendingNote.defaultKey);
      const g = gradeShot(j.brief, j.last.stream, this.relicSet());
      const b = j.brief;
      let pay = 0;
      if (b.kind === 'gig') {
        const noteMul = (b.payBoost || 1) * (b.payMulNote || 1);
        pay = g.pass ? Math.round(b.pay * CONFIG.gradeMult[g.grade] * (b.client && CLIENTS[b.client].persona === 'flipper' && b.twisted ? 1.3 : 1) * noteMul / 10) * 10 : Math.round(b.pay * CONFIG.killFee / 10) * 10;
      }
      const s = j.last.stream;
      const el = (s && !s.dead) ? (dominantElement(s, this.relicSet()) || b.hero) : b.hero;
      const shot = {
        week: this.week, kind: b.kind, el: b.hero, mainEl: el, stars: g.stars, grade: g.grade, nda: !!b.nda, ng: !g.pass,
        title: b.title, client: b.client || null, studio: b.studio || null,
        look: s ? snapshotLook(s, this.relicSet()) : null, seed: j.seedBase
      };
      if (b.kind !== 'test' || g.pass) this.reel.push(shot);
      if (this.hasRelic('website') && g.pass && !b.nda) pay += 60;
      this.cash += pay;
      this.stats.earned += pay;
      this.stats.jobs += 1;
      this.stats.best = Math.max(this.stats.best, g.stars);
      const res = { ok: true, grade: g, pay, shot, kind: b.kind, pass: g.pass };
      if (b.kind === 'test' && g.pass) {
        if (b.studio === 'halcyon') { res.win = true; }
        else { res.offer = b.studio; }
      }
      this.lastDelivery = res;
      this.phase = 'delivered';
      this.log('deliver', b.kind + ':' + g.grade + ':' + pay);
      return res;
    }
    acceptOffer(accept) {
      const st = this.lastDelivery && this.lastDelivery.offer;
      if (!st) return;
      if (accept) { this.ending = { id: 'offer_' + st, studio: st }; this.phase = 'ending'; return; }
      this.flags.declined = st;
      if (!this.hasRelic('confidence')) this.relics.push('confidence');
      this.lastDelivery.offer = null;
    }
    toWeekend() {
      const d = this.lastDelivery;
      if (d && d.win) { this.ending = { id: 'dream' }; this.phase = 'ending'; return; }
      this.job = null;
      // Sunday rent comes due even in week 12 (P2-8).
      const rent = this.rentDue();
      this.cash -= rent;
      this.stats.rentPaid += rent;
      this.lastRent = rent;
      if (this.cash < 0) { this.ending = { id: 'evicted' }; this.phase = 'ending'; return; }
      if (this.week >= CONFIG.weeks) { this.ending = { id: 'freelance' }; this.phase = 'ending'; return; }
      this.shop = this.makeShop();
      this.phase = 'weekend';
    }

    /* ---------- shop ---------- */
    makeShop() {
      const rng = mulberry32(this.seed ^ (this.week * 104729));
      const owned = new Set(this.cards.map(c => c.type));
      const caps = deckCapabilities(this.cards, this.hw, this.relicSet());
      // One course is always a missing requirement enabler, so enabler supply is
      // no longer a lottery (P0-1). If you own them all, the shop is random again.
      const missingEnablers = REQ_ENABLERS.filter(id => !owned.has(id));
      const picked = missingEnablers.length ? [pick(rng, missingEnablers)] : [];
      const ids = shuffle(rng, NODE_IDS.filter(id => !['box', 'plate'].includes(id) && !picked.includes(id)));
      // prefer unowned
      ids.sort((a, b) => (owned.has(a) ? 1 : 0) - (owned.has(b) ? 1 : 0));
      for (const id of ids) {
        if (picked.length >= CONFIG.shop.courseCount) break;
        picked.push(id);
      }
      const courses = picked.slice(0, CONFIG.shop.courseCount).map(id => ({
        type: id,
        price: Math.round((CONFIG.shop.courseMin + rng() * (CONFIG.shop.courseMax - CONFIG.shop.courseMin)) / 5) * 5,
        sold: false,
        unlocks: (NODE_UNLOCKS[id] || []).filter(rid => !caps.reqs[rid])
      }));
      const relicPool = shuffle(rng, SHOP_RELICS.filter(r => !this.relics.includes(r)));
      let relicIds = relicPool.slice(0, CONFIG.shop.relicCount);
      // The HDA (the strongest relic) is guaranteed to show up at least once
      // in a shop after week 3, so it can't be a pure lottery.
      if (this.week > 3 && !this.hasRelic('hda') && !this.flags.hdaOffered && relicPool.includes('hda')) {
        relicIds = ['hda'].concat(relicIds.filter(id => id !== 'hda')).slice(0, CONFIG.shop.relicCount);
        this.flags.hdaOffered = true;
      }
      const relics = relicIds.map(id => ({ id, price: Math.round((CONFIG.shop.relicMin + rng() * (CONFIG.shop.relicMax - CONFIG.shop.relicMin)) / 10) * 10, sold: false }));
      return { courses, relics, practiceUsed: false, coffeeUsed: false, hdaUsed: false };
    }
    hwPrice(kind) {
      if (kind === 'cpu') return this.hw.cols >= CONFIG.maxCols ? null : CONFIG.shop.cpu[this.hw.cols - CONFIG.startCols];
      if (kind === 'gpu') return this.hw.rows >= CONFIG.maxRows ? null : CONFIG.shop.gpu[this.hw.rows - CONFIG.startRows];
      if (kind === 'ram') return this.hw.ram >= CONFIG.maxRam ? null : CONFIG.shop.ram;
      return null;
    }
    buy(kind, arg, arg2) {
      const sh = this.shop;
      if (this.phase !== 'weekend' || !sh) return { ok: false };
      const pay = (p) => { if (p == null) return false; if (this.cash < p) return false; this.cash -= p; return true; };
      if (kind === 'course') {
        const it = sh.courses[arg]; if (!it || it.sold) return { ok: false };
        if (!pay(it.price)) return { ok: false, reason: 'err.cash' };
        it.sold = true; this.cards.push(makeCard(it.type)); return { ok: true };
      }
      if (kind === 'relic') {
        const it = sh.relics[arg]; if (!it || it.sold) return { ok: false };
        if (!pay(it.price)) return { ok: false, reason: 'err.cash' };
        it.sold = true; this.relics.push(it.id); return { ok: true };
      }
      if (kind === 'practice') {
        if (sh.practiceUsed) return { ok: false };
        const card = this.cards.find(c => c.uid === arg); if (!card) return { ok: false };
        if (!pay(CONFIG.shop.practice)) return { ok: false, reason: 'err.cash' };
        card.up = (card.up || 0) + 1; sh.practiceUsed = true; return { ok: true };
      }
      if (kind === 'coffee') {
        if (sh.coffeeUsed) return { ok: false };
        if (!pay(CONFIG.shop.coffee)) return { ok: false, reason: 'err.cash' };
        sh.coffeeUsed = true; this.bonusHoursNext += 3; return { ok: true };
      }
      if (kind === 'cpu' || kind === 'gpu' || kind === 'ram') {
        const p = this.hwPrice(kind); if (p == null) return { ok: false };
        if (!pay(p)) return { ok: false, reason: 'err.cash' };
        if (kind === 'cpu') this.hw.cols += 1;
        if (kind === 'gpu') this.hw.rows += 1;
        if (kind === 'ram') this.hw.ram += CONFIG.ramStep;
        return { ok: true };
      }
      if (kind === 'hda') {
        if (!this.hasRelic('hda') || sh.hdaUsed) return { ok: false };
        const a = this.cards.find(c => c.uid === arg), b = this.cards.find(c => c.uid === arg2);
        if (!a || !b || a === b || a.parts || b.parts) return { ok: false };
        if (NODE_DEFS[a.type].source && NODE_DEFS[b.type].source) return { ok: false };
        if (NODE_DEFS[b.type].source || NODE_DEFS[b.type].merge || NODE_DEFS[a.type].merge) return { ok: false, reason: 'err.hdaOrder' };
        if (!pay(CONFIG.shop.hda)) return { ok: false, reason: 'err.cash' };
        this.cards = this.cards.filter(c => c !== a && c !== b);
        this.cards.push(makeCard('hda', { type: a.type, parts: [a.type, b.type], q: 1, up: 0, hda: true }));
        sh.hdaUsed = true;
        return { ok: true };
      }
      return { ok: false };
    }
    nextWeek() {
      if (this.phase !== 'weekend') return;
      this.week += 1;
      this.shop = null;
      this.lastDelivery = null;
      this.beginWeek();
    }

    log(kind, v) { this.history.push({ w: this.week, kind, v }); }
  }

  function snapshotLook(s, relics) {
    const stars = {};
    for (const e of ELEMENT_IDS) stars[e] = streamStars(s, relics, e);
    return {
      model: s.model, tex: s.tex, stylized: s.stylized, lit: s.lit, night: s.night, final: s.final, plate: s.plate, onPlate: s.onPlate,
      env: s.env, grain: s.grain, smoke: s.smoke, polish: Math.max(0, s.polish), stars, dead: s.dead, organic: s.organic, hard: s.hard, anim: s.anim, texMatch: s.texMatch
    };
  }

  /* ================================================================
   * 11. UI strings
   * ================================================================ */
  const I18N = UI_TEXT;

  const API = {
    CONFIG, DEPTS, ELEMENTS, ELEMENT_IDS, REQS, NODE_DEFS, NODE_IDS, RELICS, BACKGROUNDS, CLIENTS, STUDIOS, I18N, LANGS,
    loc, L, t, setLang, getLang, mulberry32, hashStr,
    emptyGrid, makeCard, cardParts, cardDept, cardHours, cardRam, cardRisk, isSolverCard, cardHasQuality,
    newStream, evaluate, streamStars, streamCap, dominantElement, gradeShot, notesFor, reqLoc,
    genGig, genTest, genPortfolio, checkGate, reelGate,
    deckTypes, deckChainStep, deckCapabilities, deckRowFit, deckStarsFor, deckPolishFor, deckMinHours, makeGigFeasible, flipTargetFor, REQ_ENABLERS, NODE_UNLOCKS,
    simParams, simInit, simStep, simBonus, simPredict, simBand, simSpikeChance, snapshotLook,
    Game
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.VFXEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
