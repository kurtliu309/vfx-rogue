# 节点肉鸽 · VFX Rogue

一个**纯色块、无美术、无外部依赖**的浏览器玩法原型：你是一个有 6 个月存款的 VFX 艺术家，靠每个月做 3 个活活下来，最后拿下梦想公司的 offer。

## 打开方式

双击 `index.html` 即可（`file://` 直接跑，不需要服务器、不需要安装任何东西）。推荐 Chrome / Edge。

```text
vfx-rogue/
├── engine.js   纯逻辑：数据、计分、关卡生成、商店、整局状态机
├── index.html  界面 + 内联样式 + 内联交互脚本
├── test.js     node test.js
└── README.md
```

## 怎么玩

1. **点手牌选中**，再点网格空格放置。点场上的节点可收回手牌；FX 节点可用 `− / +` 调 substep。
2. 数据从左往右流。**空格子相当于导线**：节点连到同一行左边最近的节点，**每行最右边的节点**输出进入输出口，只有输出类型等于公司要求的类型（geo / sim / render / final）才计分。
3. 右侧实时显示每行预估分、总耗时/预算、爆炸率、部门羁绊。点 **COOK** 开始掷骰结算；达标即过关，不达标还能在剩余次数内继续调整。
4. 每关默认 3 次 Cook；次数耗尽仍未达标 = 这关失败，无奖励，但继续下一关。
5. 每关结束进商店。开局 $4000，每月开始扣房租 $1000；存款 < 0 立即结束。活过 6 个月的 Boss 即胜利。

**Cook 动画**：2.2 秒左右，光点沿连线从左往右跑，节点数字跳出；爆炸会红闪并显示 `BOOM`。预算超限时 Cook 按钮禁用，引擎也会拒绝结算且不消耗次数。

## 语言 / Language

- 默认英文。顶栏右上角的 **`EN / 中文`** 按钮即时切换整页语言：不刷新、不丢当前局、不重抽关卡。
- 选择保存在 `localStorage`（key：`vfxRogue.lang`）。读写都包在 `try/catch` 里；读不到、被禁用或值非法时回退英文。
- **新增界面文字**：在 `engine.js` 的 `I18N.en` 和 `I18N.zh` 两张表里同时加同名 key，界面代码用 `t('your.key')` 取文字；需要插值就写 `{name}` / `{n}` 这类占位符，调用 `t('your.key', { name: ... })`。`test.js` 会检查两张表的 key 完全一致且非空。
- **新增数据文字**（节点、遗物、规则、公司名、部门、端口）：用 `loc(en, zh)` 同时写两种语言，例如
  ```js
  name: loc('Box', '盒子'),
  desc: loc('Basic model source. Outputs 10 geo.', '基础模型源。输出 10 几何。')
  ```
  界面用 `tr(def.name)` / `tr(def.desc)` 按当前语言取值。engine 的计分逻辑只认 `type` / `id`，不要用显示文字做判断。
- 节点英文名用行业原词：Box、Sculpt、Kitbash、Scan、Pyro、FLIP、Vellum、RBD、Key Light、Render、HDRI、Light Linking、Grade、Roto、Keyer、Despill、Merge；中文版可以保留这些英文行业词。
- 报错和提示由 engine 返回 `err.*` / `end.*` 这类 key，界面统一用 `t(res.reason)` 翻译；不要在 engine 里写死显示文字。
- 测试、冒烟、预览一律用英文界面。

## 网格与端口

- 网格 3 行 × 6 列，第 7 列是每行的输出口（不可放节点）。
- 输出口要求由公司卡决定；类型不符本行计 0 分。
- 端口：`geo` 灰方块、`sim` 橙三角、`render` 蓝圆、`final` 金菱形。
- 普通节点只接左侧相邻格；类型不匹配时连线断开（红色虚线 + ×）。Merge 例外，收左、左上、左下三格。
- 非源节点没有有效输入 = 灰掉、无输出。
- **耗时按网格上放置的所有节点计**（包括暂时没接通/灰掉的节点），所以别把网格当仓库。

## 节点表

| 节点 | 部门 | 输入 → 输出 | 数值 / 机制 | h |
|---|---|---|---|---|
| Box | Model | 源 → geo | 10 | 1 |
| Sculpt | Model | 源 → geo | 25 | 3 |
| Kitbash | Model | 源 → geo | 8；同列每有一个其他 Model +12 | 1 |
| Scan | Model | 源 → geo | 15；同列上下相邻有 Lighting 时 ×2 | 2 |
| Pyro | FX | geo/sim → sim | 输入 ×2.5；substep 每级 ×1.4 | 2 |
| FLIP | FX | geo/sim → sim | 输入 ×2；substep 每级 ×1.6 | 2 |
| Vellum | FX | geo/sim → sim | 输入 +30；永不爆炸；substep 仍 ×1.4 | 1 |
| RBD 破碎 | FX | geo/sim → sim | 输入 ×(1 + 0.5×本行上游 Model 数) | 2 |
| Key Light | Lighting | geo/sim → render | 输入 ×1.5；光环：同列上下相邻非 Lighting ×1.3 | 1 |
| Render | Lighting | geo/sim → render | 输入 ×2 | 4 |
| HDRI | Lighting | geo/sim → render | 输入 ×1.2；同列有其他 Lighting 时自身 ×1.5 | 1 |
| Light Linking | Lighting | geo/sim → render | 输入 ×1；光环 ×1.2；同列相邻 Render 耗时 -2h | 1 |
| Grade | Comp | render/final → final | 输入 ×(1 + 0.15×本行上游节点数) | 1 |
| Roto | Comp | render/final → final | 输入 +20；救场见下 | 2 |
| Key 绿幕 | Comp | render/final → final | 输入 +40 | 1 |
| Despill | Comp | render/final → final | 输入 ×1.3；每个紧挨着的 Comp 额外 +10 | 1 |
| Merge | 通用 | 左/左上/左下 → 取最靠后类型 | 输入相加 ×(1 + 0.25×来源链不同部门数) | 1 |

### FX substep

默认 1，范围 1–4。substep 每 +1：输出再 ×1.4（FLIP ×1.6），耗时 +1h，爆炸概率依次为 **0% / 15% / 35% / 60%**。爆炸时该节点输出归零、下游断流（缓存习惯遗物可保留 50%）。

### Comp / Roto 救场

若本行上游有节点爆炸，Roto 会取最近一次爆炸的**爆炸前值 × 60%** 作为输入，再 +20，继续向下游供流。

### Merge

- 只连左、左上、左下三格；任何类型都收。
- 值 = 三路有效输入之和 × (1 + 0.25 × 三条来源链里出现过的不同部门数)，最多 4 个部门 → ×2。
- 输出类型 = 输入类型里 rank 最高的（geo < sim < render < final）。

## 部门羁绊（本关网格上有效参与节点数）

| 条件 | 效果 |
|---|---|
| Model ≥ 3 | 所有 Model 基础值 +10 |
| FX ≥ 3 | 所有爆炸概率 -10 个百分点（最低 0） |
| Lighting ≥ 3 | Key Light 光环 1.3→1.5，Light Linking 光环 1.2→1.35 |
| Comp ≥ 3 | 所有 Comp 节点耗时变 0 |

“有效参与”按结构上接通的节点统计；只招专才里的直通节点也会计入所在部门。Lighting 光环不作用在 Lighting 自己身上，多个光环相乘。

## 公司规则、遗物、商店

- 公司规则池：无规则 / FX 专门店 / 广告公司 / Lighting 职位 / 要全面的人 / 只招专才 / 渲染农场紧张 / 客户改需求 / 外包大厂。Boss 从硬规则池里抽。
  - 只招专才：除 Model 外，网格上数量最多的非 Model 部门有效；其他部门节点直通 ×1、0h，保留自己的输入/输出端口但不吃倍率/光环/爆炸（同票按 FX → Lighting → Comp 取先）。
  - 要全面的人：每条**计分的行**如果来源链少于 3 个不同部门，该行分数减半。
  - 外包大厂：目标分 ×0.8、本关奖励减半。
  - 客户改需求：本关 Cook 次数 2（导师 +1 仍生效）。
- 遗物 8 个：Houdini 精通、VEX、USD 管线、缓存习惯、Nuke 快捷键、导师、咖啡因依赖、作品集网站；不会重复获得。
  - VEX：每关一次，对场上一个节点点 `VEX` 按钮，输出 ×2。
  - USD：每关第一处端口不匹配视为能连（列优先、行优先扫描）。
- 每关结束商店：3 个随机节点（$150–300）、1 个遗物（$400）、删牌（$100，每次商店一次）、升级节点（$200，+25%，每次商店一次）、离开。
- 中型工作室达标后三选一遗物；Boss 不给遗物，给 $1500。
- 工资/租金：零活 +$600、中型 +$900、Boss +$1500；中型/Boss 目标更高。开局 $4000，月租 $1000；咖啡因依赖使月租 +$200。

## 数值在哪里改

全部在 `engine.js`：

- **`CONFIG`（文件顶部）**：起始存款、房租、手牌数、Cook 次数、目标曲线 `targetBase / targetGrowth / bossTargetMultiplier`、预算上下限、奖励、商店价格、升级倍率、羁绊加成等。
  - 目标分 ≈ `round(targetBase × targetGrowth^关卡序号)`，Boss 再 ×`bossTargetMultiplier`。
  - 这里把 `targetGrowth` 设为 **1.26** 而不是规格参考的约 1.32：在 10–14h 预算与给定节点数值下，1.32 曲线的第 5–6 个月基本无解。想更硬就把它调回 1.32（或更高），想更简单就调低。
- **`NODE_DEFS`**：每个节点的 `base / mult / flat / hours / substepMult / aura / input / output`，以及 `name` / `desc`（均为 `{en, zh}` 双语对象）。
- **`RULES`、`RELICS`、`COMPANY_NAMES`**：规则、遗物、虚构公司名，名称和说明均为 `{en, zh}` 双语对象。
- **`I18N`**：界面通用文字，`en` / `zh` 两张 key 相同的表；`t(key, lang)` 取文字，`L(value, lang)` 取数据表双语文字。
- **`generateLevels()`**：每关抽规则、目标输出类型、预算、Boss 倍率和奖励。
- **`Game` 类**：租金、抽牌、Cook 次数、Cook、关卡结算、遗物三选一、商店、月份推进、死亡/胜利条件。
- **`evaluate()`**：端口连通、结构连通与羁绊、耗时、逐列计分、光环、爆炸、Roto 救场、Merge、规则影响。随机函数通过 opts.rng 注入，预览时 `roll: false`。

## 测试

```bash
node test.js
```

覆盖：直线链计分、端口不匹配、USD、Lighting 光环与羁绊、Model 纵向堆叠、substep 爆炸（注入 rng）、Roto 救场、Merge 汇合、输出类型不符、预算超限禁止 Cook、Comp 羁绊、只招专才、要全面的人、关卡生成、局内经济；以及 i18n（en / zh key 一致且非空、节点/遗物/规则/部门/端口/公司名双语、`t()` / `L()`、关卡数据保存双语对象）。最后一行输出：

```text
ALL TESTS PASSED
```

## 已知取舍 / 偏离规格

- `targetGrowth` 取 1.26（便于六个月通关），不是参考的约 1.32；见上文调参。
- 所有已放置节点都计耗时（包含因端口不匹配而灰掉的节点），不是只计有效链。
- “有效参与”按结构连通统计，不按本次 Cook 是否爆炸统计（否则羁绊会随掷骰波动，预览也无法稳定显示）。
- 最后一关 Boss 结算后直接进入结局，不再开一次商店。
- 牌组与整局进度只保存在内存中，刷新即开新局；没有做存档。
- 只有语言偏好写入 `localStorage`（`vfxRogue.lang`），游戏进度不写存储。
