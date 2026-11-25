# Node Rogue · 节点肉鸽

A VFX survival roguelite in pixel art. You were laid off when your studio closed. Twelve weeks of savings, a landlord who likes rent more than you, a cat, and one dream studio.

特效师求生像素肉鸽。工作室倒闭，你被裁了。十二周存款，一个更爱房租的房东，一只猫，一家梦想公司。

**Play / 试玩：** https://kurtliu309.github.io/vfx-rogue/ （或双击 `index.html`，无需服务器）

## 文件

```text
vfx-rogue/
├── index.html  界面、样式、交互、动画循环
├── engine.js   纯逻辑：节点、求值、评级、dailies/缓存、解算、经济、整局状态机（不碰 DOM）
├── story.js    角色、客户、工作室、客户 note、每周剧情、随机事件、结局
├── i18n.js     界面文字（en / zh 两张表 key 必须一致）
├── art.js      程序化像素美术：节点图标、头像、公寓、标题、镜头视口、解算窗口、结局画面
├── audio.js    WebAudio 合成音效 + chiptune 背景音乐
└── test.js     node test.js（最后一行 ALL TESTS PASSED）
```

全部普通 `<script>`，没有模块和外部依赖（只有 Google Fonts 像素字体，离线时回退系统字体）。

## 一局怎么走

- 12 周三幕。每周：周一看邮件（剧情 + 随机事件选择）→ 接活板**只选一个**：零活（付钱）/ 作品集镜头（不付钱，进 reel）/ 工作室测试（第 4、8、12 周）→ 搭节点网络 → Cook（dailies）→ 交付 → 周末交房租、逛商店。
- 交不起房租 = 被赶出门。第 4 周 Kiln & Co、第 8 周 Northlight 给 offer，可接受（结局）或拒绝（得遗物“底气”）继续冲第 12 周 Halcyon。
- 结局 5 种：被赶出门 / 安稳港湾（Kiln）/ 两季合约（Northlight）/ 依然自由 / Halcyon（梦想）。结局播放整条 reel。

## 核心机制

- **网格自动连线**：数据从左往右流，空格是导线，每行右端进 OUT，镜头取最好的一行。Merge 收左、左上、左下。
- **主角元素 ★ 深度**：火 / 水 / 破碎 / 生物 / 魔法，各有 4 步依赖链（例：Pyro Source → Pyro Solver → Turbulence → Upres）。每步 +★1；质量档、解算细节、Fire Light、Heat Haze、专精遗物再加。缺上一步就像 Houdini 一样报红错。
- **管线上限**：没打光最高 ★2（playblast），没合成 ★3.5，成片 ★5。基础灯光、基础合成就够——专精一条链，其他部门用便宜节点凑。
- **Brief = 清单**：主角 ★ 门槛 + 过/不过的要求（有材质、夜景、合进实拍、颗粒、烟尘、风格化、打磨 ≥ N…）。打磨决定 C/B/A/S 和报酬倍率。
- **Dailies + 缓存**：每次 Cook 是一轮 dailies，客户回 note。没改动的节点走缓存 0 工时。客户性格：好说话 / 永远要更大 / 改主角元素 / 隐藏要求 / 完美主义 / 时间紧。
- **实时解算**：Solver 在 Cook 时逐帧跑，细节和不稳定度一起涨，玩家按“缓存”见好就收，到 100% 发散成 NaN。旁边放 Collision 更稳；Roto Rescue 能救回低一档。发散的解算下次 Cook 自动重解。
- **质量档 Q1–Q3**：更多星/打磨，更多工时和内存，有失败风险；各部门失败方式不同（面数爆、贴图丢、绑定翻转、缓存损坏、萤火虫、处理过度）。
- **硬件与资源**：CPU = 列数（5→8），GPU = 行数（2→4），内存 = 每列能放多重（超了 OOM 不能 Cook）。工时不够可花钱租渲染农场。
- **商店**：在线课程（新节点）、遗物（软件与习惯，20 个）、硬件、练习（精通节点 −1h 风险减半）、咖啡、HDA 打包（两个节点合一格）。每周固定有一门课是你还缺的要求 enabler（月灯 / 镜头颗粒 / 卡通 / 实拍合成 / 地形），带“unlocks: 夜景”这类标签。
- **开局身份**：Pyro TD / 驯水师 / 生物艺术家 / 多面手。接活板每周至少一个活对口你的专长，而且**对口那个活的额外要求一定是你当前牌组能满足的**。其他活不保证——看到做不了的活，就知道该买什么。
- **Dust Pass / 烟尘层**：1h / 2 内存的通用 FX 节点，接任何模型或解算流都能满足“烟尘”，不加主角星。

## 数值在哪改

`engine.js` 顶部 `CONFIG`：存款、房租、工时、dailies 次数、硬件上限和价格、风险、管线上限、评级门槛和倍率、解算参数、商店价格。节点在 `def(...)` 一节，遗物在 `RELICS`，开局身份在 `BACKGROUNDS`。客户、工作室门槛、剧情和事件在 `story.js`。

## 语言

默认英文，右上角 `中文 / EN` 即时切换，存在 `localStorage`（`vfxRogue.lang`）。新增界面文字要同时写进 `i18n.js` 的 en 和 zh；数据文字用 `loc(en, zh)`。进度存在 `vfxRogue.v2.save`（每周开始的邮件阶段不存档）。

## 测试

```bash
node test.js
```

覆盖：链式计分、管线上限、依赖报错、导线、Merge 实拍、发散与 Roto、材质对口、生物链与动画加成、评级、质量档、专精遗物、解算、缓存（含发散重 Cook 收工时）、OOM、工时与农场、客户 note、reel 门槛（本次测试镜头计入）、房租与驱逐（含第 12 周）、硬件、HDA、对口活可满足性、商店 enabler 供给、Dust Pass、硬盘事件、4 个开局 × 6 个种子的 12 周无头整局、双语完整性。
