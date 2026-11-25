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
    risk: [0, 0, 0.15, 0.3],
    qualityHours: 1,
    capUnlit: 2, capNoComp: 3.5, maxStars: 5,
    gradeMult: { C: 1, B: 1.25, A: 1.6, S: 2.1 },
    gradePts: { B: 2, A: 4, S: 6 },
    killFee: 0.15,
    solver: {
      frames: 48, detailRate: 2.6, instBase: 1.0, instAccel: 0.08,
      collisionMul: 0.6, guruMul: 0.78, animMul: 1.15,
      thresholds: [30, 60, 90, 120], qDetail: [1, 1, 1.22, 1.45], qInst: [1, 1, 1.25, 1.55]
    },
    shop: {
      courseMin: 90, courseMax: 210, courseCount: 3,
      practice: 110, cpu: [380, 520, 700], gpu: [480, 720], ram: 240,
      coffee: 45, relicCount: 2, relicMin: 220, relicMax: 360, hda: 160
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
    env:      { name: loc('Environment', '有环境'), hint: loc('Start a row with Terrain and merge it in.', '用 Terrain 起一行再 Merge 进来。'), test: s => !!s.env },
    stylized: { name: loc('Stylized look', '风格化'), hint: loc('Toon Shader gives the stylized look.', 'Toon Shader 给风格化外观。'), test: s => !!s.stylized },
    grain:    { name: loc('Matched grain', '匹配颗粒'), hint: loc('Lens & Grain in comp.', '合成里加 Lens & Grain。'), test: s => !!s.grain },
    smoke:    { name: loc('Smoke / dust', '烟尘'), hint: loc('Dust (after Debris) or Pyro Turbulence adds smoke.', 'Dust（接在 Debris 后）或 Turbulence 会产生烟。'), test: s => !!s.smoke },
    polish:   { name: loc('Polish ≥ {n}', '打磨 ≥ {n}'), hint: loc('Grade, Three-Point, look-dev matches and quality tiers add polish.', 'Grade、三点光、材质对口和质量档都加打磨。'), test: (s, n) => (s.polish || 0) >= n }
  };

  /* ================================================================
   * 3. nodes
   * ================================================================ */
  function newStream() {
    return {
      geo: false, organic: false, hard: false, env: false, scanned: false, plate: false,
      tex: false, texMatch: false, stylized: false, rig: false, anim: false,
      lit: false, night: false, final: false, onPlate: false, grain: false, smoke: false,
      polish: 0, dead: false, deadEl: null, deadStep: 0,
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
    return n;
  }
  function addDept(s, d) { if (!s.depts.includes(d)) s.depts.push(d); }
  const tierPolish = (ctx) => (ctx.fail ? 0 : Math.max(0, (ctx.card.q || 1) - 1));
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
        if (ctx.fail) { s.log.push('fail.' + ctx.def.dept); return; }
        s.step[el] = Math.max(s.step[el], step);
        s.bonus[el] += tierStars(ctx);
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
    apply(s, ctx) { s.geo = true; s.model = 'box'; s.polish += tierPolish(ctx); } });
  def('sculpt', { dept: 'model', h: 2, ram: 6, q: true, source: true,
    name: loc('Sculpt', '雕刻'), desc: loc('Organic geo. Creatures need it. Pairs with Skin Shader.', '有机模型。生物需要它；和 Skin Shader 对口。'),
    apply(s, ctx) { s.geo = true; s.organic = true; s.model = 'organic'; s.polish += tierPolish(ctx); } });
  def('hardsurf', { dept: 'model', h: 2, ram: 4, q: true, source: true,
    name: loc('Hard Surface', '硬表面'), desc: loc('Hard-surface geo. Fracture +0.5★. Pairs with Metal Shader.', '硬表面模型。Fracture +0.5★；和 Metal Shader 对口。'),
    apply(s, ctx) { s.geo = true; s.hard = true; s.model = 'hard'; s.polish += tierPolish(ctx); } });
  def('terrain', { dept: 'model', h: 2, ram: 6, q: true, source: true,
    name: loc('Terrain', '地形'), desc: loc('Environment geo. Satisfies “Environment”. Pairs with Texture Paint.', '环境模型，满足“有环境”；和 Texture Paint 对口。'),
    apply(s, ctx) { s.geo = true; s.env = true; s.model = 'env'; s.polish += tierPolish(ctx); } });
  def('scan', { dept: 'model', h: 3, ram: 8, q: true, source: true,
    name: loc('Photo Scan', '扫描模型'), desc: loc('Scanned asset: comes textured, +1 polish. Heavy.', '扫描资产：自带材质，+1 打磨。很吃内存。'),
    apply(s, ctx) { s.geo = true; s.scanned = true; s.tex = true; s.hard = true; s.model = 'scan'; s.polish += 1 + tierPolish(ctx); } });
  def('plate', { dept: 'plate', h: 0, ram: 2, source: true,
    name: loc('Plate', '实拍素材'), desc: loc('Live-action footage. Merge it into a CG row.', '实拍画面。用 Merge 并进 CG 行。'),
    apply(s) { s.plate = true; s.model = s.model || null; } });

  // --- SURFACING ---
  function surf(id, o) {
    o.dept = 'surf'; o.q = true;
    o.check = s => (!s.geo ? 'err.needGeo' : null);
    const extra = o.extra;
    o.apply = function (s, ctx) {
      if (ctx.fail) { s.log.push('fail.surf'); return; }
      s.tex = true;
      s.polish += tierPolish(ctx);
      const m = o.match(s);
      if (m === true) { s.texMatch = true; s.polish += 1 + (ctx.relics.has('lookdev') ? 1 : 0); }
      else if (m === false) s.polish -= 1;
      if (extra) extra(s, ctx);
    };
    return def(id, o);
  }
  surf('shader', { h: 1, ram: 2, name: loc('Basic Shader', '基础材质'), desc: loc('Textures the stream. No look-dev match.', '给数据流上材质，不算对口。'), match: () => null });
  surf('paint', { h: 2, ram: 4, name: loc('Texture Paint', '手绘贴图'), desc: loc('Match: Terrain or Sculpt (+1 polish). Box: neutral.', '对口：Terrain 或 Sculpt（+1 打磨）。'), match: s => (s.env || s.organic) ? true : (s.hard ? false : null) });
  surf('skin', { h: 2, ram: 4, name: loc('Skin Shader', '皮肤材质'), desc: loc('SSS skin. Match: Sculpt (+1 polish). Mismatch -1.', 'SSS 皮肤。对口 Sculpt（+1 打磨），不对口 -1。'), match: s => s.organic ? true : false });
  surf('metal', { h: 2, ram: 4, name: loc('Metal Shader', '金属材质'), desc: loc('Match: Hard Surface / Scan (+1 polish). Mismatch -1.', '对口：硬表面 / 扫描（+1 打磨），不对口 -1。'), match: s => s.hard ? true : false });
  surf('toon', { h: 1, ram: 2, name: loc('Toon Shader', '卡通材质'), desc: loc('Stylized look. Always a match, but never “realistic”.', '风格化外观。总算对口。'), match: () => true, extra: s => { s.stylized = true; } });

  // --- RIG / ANIM (creature chain) ---
  def('rig', Object.assign({ dept: 'char', h: 2, ram: 3, q: true,
    name: loc('Rig', '绑定'), desc: loc('Creature ★1. Needs Sculpt geo.', '生物 ★1。需要 Sculpt 模型。') },
  heroStep('creature', 1, { needs: s => s.organic, needsErr: 'err.needOrganic', apply: s => { s.rig = true; } })));
  def('animate', Object.assign({ dept: 'char', h: 3, ram: 3, q: true,
    name: loc('Animate', '动画'), desc: loc('Creature ★2. Animated input gives any later FX solver +0.5★.', '生物 ★2。之后的 FX 解算器吃到动画 +0.5★。') },
  heroStep('creature', 2, { apply: s => { s.anim = true; } })));
  def('mocap', Object.assign({ dept: 'char', h: 2, ram: 2,
    name: loc('Mocap Cleanup', '动捕清理'), desc: loc('Creature ★2, no risk, no tiers. Cheap and steady.', '生物 ★2，零风险但没有质量档。') },
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
  def('upres', Object.assign({ dept: 'fx', h: 3, ram: 14, q: true,
    name: loc('Upres', '升分辨率'), desc: loc('Fire ★4. Heavy on RAM.', '火 ★4。很吃内存。') }, heroStep('fire', 4)));
  // --- FX: water ---
  def('flipsrc', Object.assign({ dept: 'fx', h: 1, ram: 2, q: true,
    name: loc('FLIP Source', '流体源'), desc: loc('Water ★1.', '水 ★1。') }, heroStep('water', 1)));
  def('flip', Object.assign({ dept: 'fx', h: 3, ram: 16, q: true,
    name: loc('FLIP Solver', 'FLIP 解算'), desc: loc('SOLVER. Water ★2 + live sim bonus. Very heavy.', '解算器。水 ★2 + 实时解算加成。非常重。') }, solverNode('water', 2)));
  def('white', Object.assign({ dept: 'fx', h: 2, ram: 6, q: true,
    name: loc('Whitewater', '白水'), desc: loc('Water ★3. Foam and spray.', '水 ★3。泡沫和水花。') }, heroStep('water', 3)));
  def('mesher', Object.assign({ dept: 'fx', h: 2, ram: 8, q: true,
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
      if (ctx.fail) { s.polish -= 2; s.log.push('fail.light'); }
      else s.polish += tierPolish(ctx);
      if (base) base(s, ctx);
    };
    return def(id, o);
  }
  light('light', { h: 1, ram: 4, name: loc('Basic Light', '基础灯光'), desc: loc('Lights & renders the stream.', '打光并渲染。') });
  light('threept', { h: 2, ram: 4, name: loc('Three-Point', '三点布光'), desc: loc('Lit, +1 polish.', '打光，+1 打磨。'), extra: s => { s.polish += 1; } });
  light('hdri', { h: 1, ram: 4, name: loc('HDRI Dome', 'HDRI 环境光'), desc: loc('Lit. +2 polish if Environment is in the stream.', '打光。流里有环境时 +2 打磨。'), extra: s => { if (s.env) s.polish += 2; } });
  light('moon', { h: 1, ram: 4, name: loc('Moonlight', '月光'), desc: loc('Lit, makes it a night shot.', '打光，变成夜景。'), extra: s => { s.night = true; } });
  light('firelight', { h: 2, ram: 6, name: loc('Fire Light', '火光照明'), desc: loc('Needs fire. Lit, fire +0.5★, +1 polish.', '需要火。打光，火 +0.5★，+1 打磨。'),
    check: s => (!s.geo ? 'err.needGeo' : (s.step.fire < 1 ? 'err.needFire' : null)),
    extra: s => { s.bonus.fire += 0.5; s.polish += 1; } });
  light('pathtrace', { h: 5, ram: 16, name: loc('Path Tracer', '路径追踪'), desc: loc('Lit, +2 polish. Slow, heavy.', '打光，+2 打磨。又慢又重。'), extra: s => { s.polish += 2; } });

  // --- COMP ---
  function comp(id, o) {
    o.dept = 'comp';
    if (o.q == null) o.q = true;
    const base = o.extra;
    o.check = o.check || (s => (!s.lit ? 'err.needLit' : null));
    o.apply = function (s, ctx) {
      s.final = true;
      if (ctx.fail) { s.polish -= 1; s.log.push('fail.comp'); }
      else s.polish += tierPolish(ctx);
      if (base) base(s, ctx);
    };
    return def(id, o);
  }
  comp('comp', { h: 1, ram: 2, name: loc('Basic Comp', '基础合成'), desc: loc('Finishes the shot (final).', '完成镜头（成片）。') });
  comp('plateint', { h: 2, ram: 4, name: loc('Plate Integrate', '实拍合成'), desc: loc('Needs a Plate merged in. Final + “On the plate”.', '需要并进实拍。成片 + 合进实拍。'),
    check: s => (!s.lit ? 'err.needLit' : (!s.plate ? 'err.needPlate' : null)),
    extra: s => { s.onPlate = true; } });
  comp('grade', { h: 1, ram: 2, name: loc('Grade', '调色'), desc: loc('Final, +1 polish (+1 more with LUT Library).', '成片，+1 打磨（LUT 库再 +1）。'),
    extra: (s, ctx) => { s.polish += 1 + (ctx.relics.has('lut') ? 1 : 0); } });
  comp('lens', { h: 1, ram: 2, name: loc('Lens & Grain', '镜头与颗粒'), desc: loc('Final, matched grain, +1 polish.', '成片，匹配颗粒，+1 打磨。'), extra: s => { s.grain = true; s.polish += 1; } });
  comp('haze', { h: 1, ram: 2, name: loc('Heat Haze', '热浪扭曲'), desc: loc('Needs fire. Final, fire +0.5★.', '需要火。成片，火 +0.5★。'),
    check: s => (!s.lit ? 'err.needLit' : (s.step.fire < 1 ? 'err.needFire' : null)), extra: s => { s.bonus.fire += 0.5; } });
  def('glow', { dept: 'comp', h: 1, ram: 2, q: true, hero: { el: 'magic', step: 4 },
    name: loc('Glow', '辉光'), desc: loc('Magic ★4. Needs Trails and Lighting. Final.', '魔法 ★4。需要拖尾和灯光。成片。'),
    check: s => (!s.lit ? 'err.needLit' : (s.step.magic < 3 ? 'err.needStep' : null)),
    apply(s, ctx) { s.final = true; if (ctx.fail) { s.log.push('fail.comp'); return; } s.step.magic = Math.max(s.step.magic, 4); s.bonus.magic += tierStars(ctx); } });
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
    usd:      { icon: 'usd', name: loc('USD Pipeline', 'USD 管线'), desc: loc('Merge costs 0h and adds +1 polish.', 'Merge 不耗时，且 +1 打磨。') },
    farm:     { icon: 'farm', name: loc('Farm Account', '农场账户'), desc: loc('Render farm hours cost half.', '渲染农场半价。') },
    caffeine: { icon: 'coffee', name: loc('Caffeine Habit', '咖啡因依赖'), desc: loc('+3h every week. Rent +$25 (coffee).', '每周 +3 小时。房租 +$25（咖啡钱）。') },
    monitor:  { icon: 'monitor', name: loc('Second Monitor', '第二块屏'), desc: loc('See hidden client requirements before the first cook.', '第一次 Cook 前就能看到客户的隐藏要求。') },
    notebook: { icon: 'book', name: loc('Mira\'s Notebook', 'Mira 的笔记本'), desc: loc('+1 dailies per job.', '每个活 +1 次 dailies。') },
    backup:   { icon: 'drive', name: loc('Backup Drive', '备份硬盘'), desc: loc('Immune to hardware disasters.', '免疫硬件灾难事件。') },
    lut:      { icon: 'lut', name: loc('LUT Library', 'LUT 库'), desc: loc('Grade gives +1 more polish.', 'Grade 多 +1 打磨。') },
    wedge:    { icon: 'wedge', name: loc('Wedge Script', 'Wedge 脚本'), desc: loc('Sim viewer shows the predicted divergence frame.', '解算窗口显示预测的发散帧。') },
    hda:      { icon: 'hda', name: loc('HDA Toolkit', 'HDA 工具箱'), desc: loc('Unlocks “Package HDA” in the shop: fuse two nodes into one cell.', '商店解锁“打包 HDA”：两个节点合成一格。') },
    pip:      { icon: 'cat', name: loc('Pip on the Desk', '桌上的 Pip'), desc: loc('Once per job, a failed quality roll is undone. (Pip hit Ctrl+Z.)', '每个活一次，失败的质量判定被撤销（Pip 踩到了 Ctrl+Z）。') },
    website:  { icon: 'web', name: loc('Portfolio Website', '作品集网站'), desc: loc('Studio tests: +2 polish. Reel shots +$60 when delivered.', '工作室测试 +2 打磨。每个进 reel 的镜头 +$60。') },
    hotkeys:  { icon: 'keys', name: loc('Nuke Hotkeys', 'Nuke 快捷键'), desc: loc('Comp nodes cost 0h.', '合成节点不耗时。') },
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
      if (d.dept === 'comp' && relics.has('hotkeys')) x = 0;
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
      for (const k of ['geo', 'organic', 'hard', 'env', 'scanned', 'plate', 'tex', 'texMatch', 'stylized', 'rig', 'anim', 'lit', 'night', 'final', 'onPlate', 'grain', 'smoke']) s[k] = s[k] || o[k];
      for (const e of ELEMENT_IDS) {
        if (o.step[e] > s.step[e] || (o.step[e] === s.step[e] && o.bonus[e] > s.bonus[e])) { s.step[e] = o.step[e]; s.bonus[e] = o.bonus[e]; }
      }
      s.polish = Math.max(s.polish, o.polish) + Math.min(s.polish, o.polish) * 0.5;
      if (o.dead && !s.dead) { s.dead = true; s.deadEl = o.deadEl; s.deadStep = o.deadStep; }
      for (const d of o.depts) addDept(s, d);
      if (!s.model && o.model) s.model = o.model;
      s.rows += o.rows;
    }
    s.polish = Math.floor(s.polish);
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
            const m = mergeStreams([s, up, dn]);
            if (!m) { err = 'err.noInput'; break; }
            s = m; addDept(s, 'util');
            if (relics.has('usd')) s.polish += 1;
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
    // overall polish relic
    if (relics.has('confidence')) rowOut.forEach(s => { if (s) s.polish += 1; });
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
  function gradeShot(brief, s, relics) {
    const out = { pass: false, missing: [], stars: 0, polish: 0, pts: 0, score: -999, grade: 'F', el: brief.hero, dead: false };
    if (!s) { out.missing = ['nostream']; return out; }
    if (s.dead) { out.dead = true; out.missing = ['dead']; return out; }
    out.stars = streamStars(s, relics, brief.hero);
    out.polish = Math.max(0, s.polish);
    const reqs = brief.reqs.concat(brief.revealed || []);
    for (const q of reqs) { if (!REQS[q.id].test(s, q.n)) out.missing.push(q.id); }
    const heroOk = out.stars >= brief.minStars;
    if (!heroOk) out.missing.unshift('hero');
    out.pass = out.missing.length === 0;
    out.pts = Math.max(0, (out.stars - brief.minStars) * 2 + out.polish);
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
        const pr = brief.reqs.find(q => q.id === 'polish');
        if (pr) { pr.n += 1; } else brief.reqs.push({ id: 'polish', n: 3 });
        brief.twisted = true;
        lines.push(pick(rng, NL.auteur));
        changes.polish = true;
      }
    }
    if (g.pass && !lines.length) {
      if (g.grade === 'S') lines.push(pick(rng, NL.love));
      else lines.push(pick(rng, NL.ok));
    }
    if (!lines.length) lines.push(pick(rng, NL.ok));
    return { persona, lines, changes };
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
  function genGig(rng, week, clientId, bg) {
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
    const hidden = cl.persona === 'secret' ? { id: pick(rng, REQ_POOL.filter(x => !reqs.some(q => q.id === x) && x !== 'plate')) } : null;
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
  function checkGate(gate, reel) {
    const eligible = reel.filter(s => !s.nda && !s.ng);
    const res = { ok: true, lines: [] };
    const good = eligible.filter(s => s.stars >= gate.stars);
    const okCount = good.length >= gate.count;
    res.lines.push({ ok: okCount, key: 'gate.count', vars: { n: gate.count, s: gate.stars, have: good.length } });
    if (!okCount) res.ok = false;
    if (gate.distinct) {
      const d = new Set(good.map(s => s.el)).size;
      const ok = d >= gate.distinct;
      res.lines.push({ ok, key: 'gate.distinct', vars: { n: gate.distinct, have: d } });
      if (!ok) res.ok = false;
    }
    if (gate.top) {
      const ok = eligible.some(s => s.stars >= gate.top);
      res.lines.push({ ok, key: 'gate.top', vars: { s: gate.top } });
      if (!ok) res.ok = false;
    }
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
    if (opts.anim) { inst *= S.animMul; accel *= S.animMul; }
    if (opts.tutorial) { inst *= 0.55; accel *= 0.55; }
    const el = NODE_DEFS[cardParts(card).find(p => NODE_DEFS[p].solver)].hero.el;
    return { detail: S.detailRate * S.qDetail[q], inst, accel, frames: S.frames, el };
  }
  function simInit(params, seed) {
    return { f: 0, detail: 0, inst: 0, diverged: false, done: false, params, seed: seed >>> 0, history: [] };
  }
  function simStep(st, rng) {
    if (st.done) return st;
    const p = st.params;
    st.f += 1;
    st.detail += p.detail * (0.85 + rng() * 0.3);
    let g = (p.inst + p.accel * st.f) * (0.55 + rng() * 0.9);
    if (rng() < 0.06) g *= 2.6; // spike
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
  function simPredict(params) {
    // expected divergence frame (no noise) for the Wedge relic
    let inst = 0;
    for (let f = 1; f <= params.frames; f++) { inst += (params.inst + params.accel * f); if (inst >= 100) return f; }
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
      const gigs = [];
      const n = this.week === 1 ? 1 : 3;
      for (let i = 0; i < n; i++) gigs.push(genGig(rng, this.week, this.week === 1 ? 'rumble' : pool[i % pool.length], this.bg));
      // one gig always speaks to what you're good at
      const fav = this.favoriteElement();
      if (n > 1 && fav && !gigs.some(gg => gg.hero === fav)) {
        const gi = Math.floor(rng() * n);
        gigs[gi].hero = fav; gigs[gi].title = pick(rng, ELEMENTS[fav].noun);
        if (gigs[gi].flipTo === fav) gigs[gi].flipTo = pick(rng, ELEMENT_IDS.filter(e => e !== fav));
      }
      if (this.week === 1) { gigs[0].minStars = 1; gigs[0].reqs = [{ id: 'lit' }]; gigs[0].hero = BACKGROUNDS[this.bg].el || 'destr'; gigs[0].tutorial = true; gigs[0].title = ELEMENTS[gigs[0].hero].noun[0]; gigs[0].pay = 520; gigs[0].nda = false; }
      const board = { gigs, portfolio: this.week > 1 ? genPortfolio() : null, test: null };
      const tw = CONFIG.testWeeks[this.week];
      if (tw) {
        board.test = genTest(rng, tw, this.week);
        board.testGate = checkGate(reelGate(tw), this.reel);
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
      const hours = CONFIG.baseHours + (brief.hoursMod || 0) + this.bonusHoursNext + (this.hasRelic('caffeine') ? 3 : 0) + (this.flags.hoursPenalty || 0);
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
      this.cash -= p; j.farmBought += 1; j.hoursLeft += CONFIG.farmHours; j.hoursTotal += CONFIG.farmHours;
      this.log('farm', p);
      return { ok: true, price: p };
    }

    /* Cook: step 1 — plan (which solvers need a live sim) */
    prepareCook() {
      const j = this.job;
      if (!j) return { ok: false };
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
        const params = simParams(card, { collision: collisionNear(j.grid, r, c), guru: this.hasRelic('guru'), anim: !!(inStream && inStream.anim), tutorial: !!j.brief.tutorial });
        sims.push({ key, r, c, type: card.type, params, seed: (j.seedBase + j.dailiesUsed * 131 + r * 17 + c * 7) >>> 0, predict: this.hasRelic('wedge') ? simPredict(params) : null });
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
      // memory blow-up from model fails
      let oomRow = null;
      for (const f of fresh) {
        if (f.dept === 'model') {
          const [r, c] = f.key.split(',').map(Number);
          if (ev.colRam[c] + 8 > this.hw.ram) { oomRow = r; }
        }
      }
      if (oomRow != null) { ev.rowOut[oomRow] = null; ev.best = null; for (let r = 0; r < ev.R; r++) { const g = gradeShot(j.brief, ev.rowOut[r], this.relicSet()); g.row = r; if (!ev.best || g.score > ev.best.score) ev.best = g; } }
      const okKeys = {};
      for (let r = 0; r < ev.R; r++) for (let c = 0; c < ev.C; c++) if (ev.cells[r][c] && ev.cells[r][c].status === 'ok' && !ev.cells[r][c].empty && !(solver[r + ',' + c] && solver[r + ',' + c].diverged)) okKeys[r + ',' + c] = true;
      j.hoursLeft -= plan.cost;
      const g = ev.best;
      const notes = notesFor(j.brief, g, j.dailiesUsed, rng);
      j.dailiesUsed += 1;
      j.last = { sigs: ev.sigs, okKeys, solver, fails, grade: g, stream: g && ev.rowOut[g.row], ev, fresh, oomRow, notes, cost: plan.cost, cachedCount: Object.values(ev0.cached).filter(Boolean).length };
      // grade again after notes possibly changed the brief (twists apply to NEXT delivery)
      j.last.gradeAfter = gradeShot(j.brief, j.last.stream, this.relicSet());
      j.notes.push(notes);
      j.results.push({ grade: g.grade, stars: g.stars, polish: g.polish });
      return { ok: true, ev, grade: g, notes, fresh, oomRow, cost: plan.cost };
    }

    canDeliver() { return !!(this.job && this.job.last); }
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
      const g = gradeShot(j.brief, j.last.stream, this.relicSet());
      const b = j.brief;
      let pay = 0;
      if (b.kind === 'gig') {
        pay = g.pass ? Math.round(b.pay * CONFIG.gradeMult[g.grade] * (b.client && CLIENTS[b.client].persona === 'flipper' && b.twisted ? 1.3 : 1) / 10) * 10 : Math.round(b.pay * CONFIG.killFee / 10) * 10;
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
      if (this.week >= CONFIG.weeks) { this.ending = { id: 'freelance' }; this.phase = 'ending'; return; }
      this.job = null;
      // pay rent
      const rent = this.rentDue();
      this.cash -= rent;
      this.stats.rentPaid += rent;
      this.lastRent = rent;
      if (this.cash < 0) { this.ending = { id: 'evicted' }; this.phase = 'ending'; return; }
      this.shop = this.makeShop();
      this.phase = 'weekend';
    }

    /* ---------- shop ---------- */
    makeShop() {
      const rng = mulberry32(this.seed ^ (this.week * 104729));
      const owned = new Set(this.cards.map(c => c.type));
      const ids = shuffle(rng, NODE_IDS.filter(id => !['box', 'plate'].includes(id)));
      // prefer unowned
      ids.sort((a, b) => (owned.has(a) ? 1 : 0) - (owned.has(b) ? 1 : 0));
      const courses = ids.slice(0, CONFIG.shop.courseCount + 1).map(id => ({ type: id, price: Math.round((CONFIG.shop.courseMin + rng() * (CONFIG.shop.courseMax - CONFIG.shop.courseMin)) / 5) * 5, sold: false }));
      const relicPool = shuffle(rng, SHOP_RELICS.filter(r => !this.relics.includes(r)));
      const relics = relicPool.slice(0, CONFIG.shop.relicCount).map(id => ({ id, price: Math.round((CONFIG.shop.relicMin + rng() * (CONFIG.shop.relicMax - CONFIG.shop.relicMin)) / 10) * 10, sold: false }));
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
    simParams, simInit, simStep, simBonus, simPredict, snapshotLook,
    Game
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.VFXEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
