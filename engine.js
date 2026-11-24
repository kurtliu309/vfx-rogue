/* 节点肉鸽 — 纯逻辑引擎（浏览器全局 VFXEngine / Node CommonJS） */
(function (global) {
  'use strict';

  /* ================================================================
   * 1. 顶层可调数值
   * ================================================================ */
  const CONFIG = {
    startingMoney: 4000,
    startingDeck: [
      'box', 'box', 'sculpt',
      'pyro', 'pyro', 'flip',
      'keylight', 'render',
      'grade', 'roto', 'merge', 'keygreen'
    ],
    months: 6,
    levelsPerMonth: 3,
    rent: 1000,
    caffeineExtraRent: 200,
    handSize: 8,
    baseCooks: 3,
    clientChangeCooks: 2,
    mentorExtraCook: 1,
    targetBase: 50,
    // 规格给出的参考曲线约为 1.32；这里采用 1.26，以保证 6 个月在
    // 10–14h 预算下存在通关打法（见 README「数值调节」）。
    targetGrowth: 1.26,
    bossTargetMultiplier: 1.3,
    budgetMin: 10,
    budgetMax: 14,
    renderFarmBudgetPenalty: 3,
    caffeineBudgetBonus: 3,
    rewards: { side: 600, mid: 900, boss: 1500 },
    portfolioBonus: 100,
    shop: {
      nodeMin: 150,
      nodeMax: 300,
      relicPrice: 400,
      deletePrice: 100,
      upgradePrice: 200,
      nodeCount: 3
    },
    upgradeMultiplier: 1.25,
    substepHours: 1,
    fxBondExplosionReduction: 0.10,
    modelBondBonus: 10,
    lightingBondAura: 1.5,
    lightingLinkBondAura: 1.35,
    mergeDeptBonus: 0.25,
    outsourceTargetMultiplier: 0.8,
    outsourceRewardMultiplier: 0.5,
    usdRelicFreeMismatchesPerLevel: 1
  };

  /* ================================================================
   * 2. 文字表 / i18n
   * ================================================================ */
  const DEFAULT_LANG = 'en';
  const LANGS = ['en', 'zh'];

  /* 界面通用文字。两张表的 key 必须完全一致（test.js 会检查）。
     数据表里的名称 / 说明用 loc(en, zh) 直接带双语。 */
  const I18N = {
    en: {
      'app.title': 'Node Rogue',
      'app.brand': 'NODE ROGUE',
      'app.brandSub': 'NODE ROGUE · VFX SURVIVAL',

      'top.monthLevel': 'Month {month} · Level {slot}/3',
      'top.monthLabel': 'MONTH / LEVEL',
      'top.money': 'CASH',
      'top.rent': 'NEXT RENT',
      'top.rentShort': 'RENT',
      'top.relicStripTip': 'Relics you own. Hover to see their effects.',
      'top.noRelicsTip': 'No relics yet. Clear a mid-size studio job to pick one of three.',
      'top.help': '? Rules',
      'top.helpTitle': 'How to play',
      'top.deck': 'Deck {n}',
      'top.deckTitle': 'View deck',
      'top.langTip': 'Switch language',
      'top.langToggle': 'EN / 中文',
      'top.menu': 'Menu',
      'top.menuTitle': 'Menu',
      'top.monthShort': 'M{month} · {slot}/3',

      'menu.kicker': 'MENU',
      'menu.title': 'Menu',
      'menu.rules': 'Rules & how to play',
      'menu.deck': 'View deck',
      'menu.relics': 'Relics',

      'relics.title': 'Relics',
      'relics.count': 'Owned: {n}',
      'relics.empty': 'No relics yet. Clear a mid-size studio job to pick one of three.',

      'tier.boss': 'Dream Studio · BOSS',
      'tier.mid': 'Mid-size Studio',
      'tier.side': 'Freelance Gig',
      'tierShort.boss': 'BOSS',
      'tierShort.mid': 'MID',
      'tierShort.side': 'GIG',

      'company.label': 'CLIENT / BRIEF',
      'company.requiresOutput': 'Job requires output',
      'company.targetScore': 'Target score',
      'company.targetShort': 'Target',
      'company.cookBudget': 'Cook budget',
      'company.budgetShort': 'Budget',
      'company.cashReward': 'Cash reward',
      'company.currentEstimate': 'Current estimate',
      'company.specialRule': 'Special rule · {name}',
      'company.footerLevel': 'Level {index}/18 · {tier}',
      'company.expandTip': 'Tap to expand the brief',
      'company.collapseTip': 'Tap to collapse the brief',

      'board.title': 'Node Grid',
      'board.subtitle': 'COOKING GRID',
      'board.flowHint': 'Data flow',
      'board.flowTarget': 'rightmost node → output',
      'board.emptyCellTip': 'Empty cell. Pick a node from your hand first.',
      'board.placeTip': 'Place the selected node.',
      'output.label': 'OUT {n}',
      'output.waiting': 'Not connected',
      'output.tipHeader': 'Output slot for row {row}.',
      'output.tipRule': 'Fed by the rightmost node in this row; the type must be {port}.',
      'output.tipCurrent': 'Current: {port} · value {value}',
      'output.tipMismatch': 'Type mismatch — this row scores 0.',
      'output.tipGeneralist': 'Fewer than 3 departments — Generalist Wanted halves this row.',
      'output.tipEmpty': 'No node in this row.',

      'hand.title': 'HAND',
      'hand.selectedHint': 'Selected — click an empty grid cell to place',
      'hand.hint': 'Click to select · click a placed node to take it back · FX nodes adjust substep',
      'hand.empty': 'Hand empty',
      'hand.multiOut': 'Multi',
      'hand.baseHours': 'Base time: {hours}',
      'hand.mobileHint': 'Tap to select · long-press / ⓘ for details',
      'hand.infoTip': 'View card details',
      'card.takeBack': 'Take back to hand',
      'card.detailsTitle': 'Card details',
      'card.substepLabel': 'Substep',

      'node.tipTitle': '{name} · {dept}',
      'node.inputOutput': 'Input: {input}  →  Output: {output}',
      'node.hours': 'Time: {hours}',
      'node.substepSuffix': ' · substep ',
      'node.noOutput': 'None',
      'node.passThroughTip': 'Specialist Only: this node passes through at ×1 / 0h.',
      'node.estimate': 'Est. output: {value}',
      'node.notSupplied': 'Not connected (no output)',
      'node.explosionChance': 'Explosion chance: {chance}%',
      'node.auraBonus': 'Column aura: ×{mult}',
      'node.upgraded': 'Upgraded: value ×{mult}',
      'node.vexed': 'VEX marked: value ×2',
      'node.clickToRemove': 'Click the node to take it back into your hand.',
      'node.inputSource': 'None (source)',
      'node.inputMerge': 'Left / top-left / bottom-left',
      'node.outputByInput': 'Decided by input',
      'node.clickToSelect': 'Click to select, then click an empty grid cell to place.',
      'node.directPass': 'Pass',
      'node.directPassTip': 'Specialist Only: pass-through ×1 / 0h, effects off',
      'node.upgradedBadgeTip': 'Upgraded node: value ×{mult}',
      'node.vexBadgeTip': 'VEX mark: value ×2 this level',
      'node.vexButtonTip': 'VEX: mark this node at ×2 for this level, once per level',
      'node.riskBadgeTip': 'Rolled on Cook: {chance}% chance to explode.',
      'node.sourceLabel': 'SRC',
      'node.sumLabel': 'SUM',
      'node.rbdLabel': '×MODEL',

      'short.box': 'BOX',
      'short.sculpt': 'SCL',
      'short.kitbash': 'KIT',
      'short.scan': 'SCN',
      'short.pyro': 'PYR',
      'short.flip': 'FLP',
      'short.vellum': 'VLM',
      'short.rbd': 'RBD',
      'short.keylight': 'KEY',
      'short.render': 'RND',
      'short.hdri': 'HDRI',
      'short.lightlink': 'LLK',
      'short.grade': 'GRD',
      'short.roto': 'ROT',
      'short.keygreen': 'KGR',
      'short.despill': 'DSP',
      'short.merge': 'MRG',

      'detail.title': 'Node details',
      'mobile.est': 'EST',
      'mobile.time': 'TIME',
      'mobile.risk': 'RISK',
      'mobile.cooksLeft': '{n} left',
      'ui.close': 'Close',

      'bond.title': 'Dept Bonds',
      'bond.effectiveNodes': '{n} active nodes',
      'bond.modelName': 'Model ≥ 3',
      'bond.modelEffect': 'All Model base values +{n}',
      'bond.fxName': 'FX ≥ 3',
      'bond.fxEffect': 'All explosion chance -{n}%',
      'bond.lightingName': 'Lighting ≥ 3',
      'bond.lightingEffect': 'Aura ×1.3→×1.5, Light Linking ×1.2→×1.35',
      'bond.compName': 'Comp ≥ 3',
      'bond.compEffect': 'All Comp nodes take 0h',
      'bond.tapHint': 'Tap a badge for details',
      'bond.countLine': '{n} / 3 effective {dept} nodes',

      'score.title': 'Level Estimate',
      'score.kicker': 'SCORE',
      'score.target': '/ Target <b>{n}</b>',
      'score.empty': 'Empty',
      'score.halved': ' · halved',
      'score.specialistNote': 'Specialist Only: lead department is <b>{dept}</b>; other departments pass through at ×1 / 0h.',
      'score.usdNote': 'USD Pipeline: the first port mismatch this level was allowed.',
      'score.generalistNote': 'A scoring chain has fewer than 3 departments; that row is halved.',

      'cook.title': 'Cook',
      'cook.button': 'COOK',
      'cook.kickerOver': 'OVER BUDGET',
      'cook.kickerReady': 'READY',
      'cook.budgetLabel': 'Estimated time / budget',
      'cook.ready': 'Ready to cook',
      'cook.chances': 'Cook chances',
      'cook.chancesTip': 'Up to {n} Cooks this level',
      'cook.maxRisk': 'Max explosion risk: <b>{chance}%</b>',
      'cook.fxBondActive': ' · FX bond active',
      'cook.subOk': 'Hit the target to deliver; if you miss, adjust and Cook again.',
      'cook.viewDeck': 'View Deck',
      'cook.howTo': 'How to Play',
      'cook.boom': 'BOOM',
      'cook.rescue': 'Rescue +{value}',

      'err.cooking': 'Cooking…',
      'err.levelOver': 'This level is already over',
      'err.noCooksLeft': 'No Cooks left',
      'err.overBudgetNoCook': 'Over budget — cannot Cook',
      'err.overBudget': 'Over budget',
      'err.cannotPlace': "You can't place a node right now",
      'err.cannotOperate': "You can't do that right now",
      'err.badCell': "That cell doesn't exist",
      'err.cellOccupied': 'That cell is occupied',
      'err.cardNotInHand': "That node isn't in your hand",
      'err.noNodeHere': "There's no node here",
      'err.cardNotFound': 'Node not found',
      'err.noSubstep': 'Only FX nodes have substeps',
      'err.noVexRelic': "You don't have the VEX relic",
      'err.vexNotNow': "You can't use VEX right now",
      'err.vexUsed': 'Already used this level',
      'err.placeFirst': 'Place the node on the grid first',
      'err.cannotContinue': "You can't continue right now",
      'err.notRelicPhase': 'Not in the relic pick phase',
      'err.relicNotOffered': "That relic isn't one of the choices",
      'err.relicOwned': 'You already own this relic',
      'err.notInShop': 'Not in the shop',
      'err.alreadyBought': 'Already bought',
      'err.noMoney': 'Not enough cash',
      'err.noRelicToBuy': 'No relic available to buy',
      'err.alreadyOwn': 'Already owned',
      'err.deleteUsed': 'Delete service already used this shop',
      'err.keepOneCard': 'Deck must keep at least 1 card',
      'err.cardNotFoundShort': 'Card not found',
      'err.upgradeUsed': 'Upgrade service already used this shop',
      'err.alreadyUpgraded': 'This card is already upgraded',

      'toast.pickHandFirst': 'Pick a node from your hand first.',
      'toast.vexMarked': 'VEX marked: this node outputs ×2 this level.',
      'toast.boughtNode': 'Bought {name}.',
      'toast.gotRelic': 'Relic acquired: {name}.',
      'toast.confirmDelete': 'Delete {name}? This cannot be undone and costs {price}.',
      'toast.deleted': 'Deleted {name}.',
      'toast.upgraded': 'Upgrade complete: value ×{mult}.',
      'toast.rentDead': "Can't pay rent — game over.",
      'toast.relicPicked': 'Got relic: {name}.',

      'result.kickerClear': 'COOK · CLEAR',
      'result.kickerResult': 'COOK RESULT',
      'result.title': 'Cook Result',
      'result.stampClear': 'LEVEL CLEAR',
      'result.stampFailed': 'LEVEL FAILED',
      'result.stampCook': 'COOK RESULT',
      'result.titleClear': 'Delivered',
      'result.titleFailed': 'Level Failed',
      'result.titleClose': 'So Close',
      'result.subSuccess': 'Target {target}, actual {score}. The client is happy.',
      'result.subFailed': 'Three Cooks used and the job failed. No reward — pack up and head to the next studio.',
      'result.subClose': 'You need {diff} more points. Adjust your nodes and Cook again.',
      'result.btnOffer': 'Claim the dream offer',
      'result.btnEnding': 'Face the ending',
      'result.btnContinue': 'Settle up & continue',
      'result.btnAdjust': 'Back to adjust',
      'result.statHours': 'Time / budget',
      'result.statCooks': 'Cooks left',
      'result.statDiff': 'Point gap',
      'result.row': 'Row {row} · {type}',
      'result.explosion': 'Row {row} {name} exploded ({chance}% · pre-explosion {value})',
      'result.explosionJoin': '; ',
      'result.explosionCache': '. Cache Habit kept 50% of the output.',
      'result.explosionZero': '. The node now outputs zero.',
      'result.reward': 'Level reward <b>+{money}</b>',
      'result.portfolio': ' Portfolio Site <b>+{money}</b>',
      'result.midRelic': '<br>Mid-size studio cleared: <b>pick 1 of 3 relics</b> next.',

      'deck.kicker': 'DECK',
      'deck.title': 'Deck · {n} cards',
      'misc.cook': 'Cook',
      'deck.sub': 'Draw {n} random cards each level. Upgrades are permanent.',
      'deck.ownerHand': 'Hand',
      'deck.ownerField': 'Field',

      'help.kicker': 'HOW TO PLAY',
      'help.title': 'How to Play',
      'help.sub': 'Block prototype — no art, no server required.',
      'help.b1.title': '1. Place nodes',
      'help.b1.p1': 'Pick a hand card to select it, then tap / click an empty grid cell to place. Tap / click a placed node to open its details and take it back. Use <b>− / +</b> on FX nodes to set substep.',
      'help.b1.p2': 'Data flows left to right. Empty cells act as wires: each node links to the nearest node on its left, and the <b>rightmost</b> node in a row feeds the output slot; it scores only if its type matches the client requirement.',
      'help.b2.title': '2. Port matching',
      'help.b2.p1': 'Each node accepts specific input types; if the left neighbor does not match, the wire breaks (red dashed). Model source nodes need no input.',
      'help.b2.p2': 'Ports: <span style="color:#9aa4b3">■ geo</span> · <span style="color:#ff9349">▲ sim</span> · <span style="color:#4d9dff">● render</span> · <span style="color:#ffd166">◆ final</span>.',
      'help.b3.title': '3. Cook',
      'help.b3.p1': 'Hit COOK and values flow along the wires. FX nodes may explode, zeroing their output and cutting downstream flow. You cannot Cook over budget; each level gives 3 tries by default.',
      'help.b3.p2': 'Running out of Cooks without hitting the target fails the level. No reward, but the campaign continues.',
      'help.b4.title': '4. Six months to survive',
      'help.b4.p1': 'You start with $4000; rent $1000 is charged at the start of each month. Each month has three jobs: gig / mid-size studio / dream-studio boss. Savings below 0 ends the run.',
      'help.b4.p2': 'Clearing a mid-size job lets you pick 1 of 3 relics; after each job you can shop for nodes, relics, card deletion or upgrades.',
      'help.b5.title': 'Dept mechanics',
      'help.b5.html': '<ul><li><b>Model</b>: sources; stack vertically. Kitbash feeds on other Model nodes in its column.</li><li><b>FX</b>: substep gamble — multiplier, time and explosion risk all rise together.</li><li><b>Lighting</b>: auras boost non-Lighting nodes directly above/below in the column.</li><li><b>Comp</b>: longer chains hit harder; Roto recovers 60% of an upstream explosion.</li></ul>',
      'help.b6.title': 'Bonds & utility',
      'help.b6.p1': 'Three effective nodes of the same department on the grid trigger that department bond (see the right panel).',
      'help.b6.p2': '<b>Merge</b> takes left / top-left / bottom-left inputs, sums them, multiplies by the number of distinct departments in the source chains, and outputs the highest-ranked type.',

      'relic.kicker': 'RELIC REWARD',
      'relic.title': 'Mid-size Studio · Pick 1 of 3 Relics',
      'relic.sub': '{company} loves your work. Take one relic into the next level.',
      'relic.foot': 'Relics never duplicate and last forever.',

      'shop.kicker': 'POST-JOB SHOP',
      'shop.title': '{company} · Asset Shop',
      'shop.summarySuccess': 'Level clear +{money}',
      'shop.summaryFail': 'Level failed · no reward',
      'shop.summaryScore': '{score} / {target} pts',
      'shop.summaryDefault': 'Level results',
      'shop.wallet': 'WALLET',
      'shop.cash': 'cash available',
      'shop.note': 'Delete / upgrade once each<br>Buy as many nodes as you like',
      'shop.nodesTitle': 'NODE OFFERS',
      'shop.relicTitle': 'RELIC',
      'shop.servicesTitle': 'SERVICES',
      'shop.deleteService': 'Delete card',
      'shop.upgradeService': 'Upgrade node',
      'shop.used': 'used',
      'shop.unused': 'unused',
      'shop.serviceNote': 'Pick delete / upgrade targets from the deck list on the right.',
      'shop.deckTitle': 'YOUR DECK ({n})',
      'shop.legend1': 'Delete / upgrade limited to once per shop',
      'shop.legend2': 'Grey button = unavailable',
      'shop.leave': 'Leave Shop →',
      'shop.buy': 'Buy',
      'shop.boughtNode': 'Bought',
      'shop.boughtRelic': 'Owned',
      'shop.noRelic': 'No relics left to buy here.',
      'shop.deleteBtn': 'Del {price}',
      'shop.upgradeBtn': 'Up {price}',
      'shop.deleteTitle': 'Delete card {price}',
      'shop.upgradeTitle': 'Upgrade {price}',
      'shop.next': 'Next: Month {month} · Level {slot}/3 · {tier}',
      'shop.nextRent': ' · rent {money} will be charged',
      'shop.lastCompany': 'This is the last studio.',
      'shop.offerTip': '{name}\n{desc}\nPrice {money}',

      'end.deadTitle': 'Starving Artist',
      'end.deadCopy': 'Your savings are gone. Rent and takeout wait for no one.',
      'end.broke': 'Savings below zero. Game over.',
      'end.victoryTitle': 'DREAM OFFER',
      'end.victoryCopy': 'The Month-6 boss said yes. You finally pitched your reel into {company}; tomorrow you start delivering real shots.',
      'end.noOfferTitle': 'Six Months Later',
      'end.noOfferCopy': 'You survived six months but never landed the dream-studio offer. The work remains, and the next hiring round will come.',
      'end.letterTitle': 'Offer Letter',
      'end.letterGreeting': 'To our next VFX artist:',
      'end.letterBody': 'We saw your node graphs, your caches, and the impossible things you made on budget. {company} is officially inviting you to join us.',
      'end.letterSalary': 'Salary negotiable. Rent shared.',
      'end.letterSig': '— {company} · Recruiting',
      'end.finalMoney': 'Final balance',
      'end.monthReached': 'Month reached',
      'end.monthValue': 'Month {n}',
      'end.levelsCleared': 'Levels cleared',
      'end.restart': 'Start the six months again',
      'end.dreamCompany': 'Dream Studio',
      'end.rentStart': "Couldn't pay rent at the start — you starve on the street.",
      'end.rentMonth': "Couldn't pay rent for the new month. Game over."
    },
    zh: {
      'app.title': '节点肉鸽',
      'app.brand': 'NODE ROGUE',
      'app.brandSub': '节点肉鸽 · VFX 生存战',

      'top.monthLevel': '第 {month} 月 · {slot}/3 关',
      'top.monthLabel': '月份 / 关卡',
      'top.money': '存款',
      'top.rent': '下月房租',
      'top.rentShort': '房租',
      'top.relicStripTip': '已获得的遗物。悬停查看效果。',
      'top.noRelicsTip': '还没有遗物。中型工作室达标后可以三选一。',
      'top.help': '? 规则',
      'top.helpTitle': '玩法说明',
      'top.deck': '牌组 {n}',
      'top.deckTitle': '查看牌组',
      'top.langTip': '切换语言',
      'top.langToggle': 'EN / 中文',
      'top.menu': '菜单',
      'top.menuTitle': '菜单',
      'top.monthShort': '{month}月 · {slot}/3',

      'menu.kicker': '菜单',
      'menu.title': '菜单',
      'menu.rules': '规则与玩法',
      'menu.deck': '查看牌组',
      'menu.relics': '遗物列表',

      'relics.title': '遗物',
      'relics.count': '已拥有：{n}',
      'relics.empty': '还没有遗物。中型工作室达标后可以三选一。',

      'tier.boss': 'BOSS · 梦想公司',
      'tier.mid': '中型工作室',
      'tier.side': '零活',
      'tierShort.boss': 'BOSS',
      'tierShort.mid': '中型',
      'tierShort.side': '零活',

      'company.label': '客户 / 公司卡',
      'company.requiresOutput': '本关要求输出',
      'company.targetScore': '目标分',
      'company.targetShort': '目标分',
      'company.cookBudget': 'Cook 预算',
      'company.budgetShort': '预算',
      'company.cashReward': '现金奖励',
      'company.currentEstimate': '当前预估',
      'company.specialRule': '特殊规则 · {name}',
      'company.footerLevel': '第 {index}/18 关 · {tier}',
      'company.expandTip': '点按展开公司卡',
      'company.collapseTip': '点按收起公司卡',

      'board.title': '节点网格',
      'board.subtitle': 'COOKING GRID',
      'board.flowHint': '数据流',
      'board.flowTarget': '最右节点 → 输出口',
      'board.emptyCellTip': '空格。先从手牌选一个节点。',
      'board.placeTip': '放置选中的节点。',
      'output.label': '输出 {n}',
      'output.waiting': '等待连接',
      'output.tipHeader': '第 {row} 行的输出口。',
      'output.tipRule': '只接收本行最右边节点的输出；类型必须是 {port}。',
      'output.tipCurrent': '当前：{port} · 数值 {value}',
      'output.tipMismatch': '类型不符，本行计 0 分。',
      'output.tipGeneralist': '部门数 < 3，「要全面的人」使本行减半。',
      'output.tipEmpty': '本行没有节点。',

      'hand.title': '手牌 · HAND',
      'hand.selectedHint': '已选中一张牌 → 点击网格空格放置',
      'hand.hint': '点牌选中 · 点场上节点收回 · FX 可调 substep',
      'hand.empty': '手牌为空',
      'hand.multiOut': '多路',
      'hand.baseHours': '基础耗时：{hours}',
      'hand.mobileHint': '点按选中 · 长按 / ⓘ 看说明',
      'hand.infoTip': '查看卡片说明',
      'card.takeBack': '拿回手牌',
      'card.detailsTitle': '卡片详情',
      'card.substepLabel': 'Substep',

      'node.tipTitle': '{name} · {dept}',
      'node.inputOutput': '输入：{input}  →  输出：{output}',
      'node.hours': '耗时：{hours}',
      'node.substepSuffix': ' · substep ',
      'node.noOutput': '无',
      'node.passThroughTip': '只招专才：该节点按直通 ×1 / 0h 处理。',
      'node.estimate': '预估输出：{value}',
      'node.notSupplied': '未接通（无输出）',
      'node.explosionChance': '爆炸概率：{chance}%',
      'node.auraBonus': '本列光环加成：×{mult}',
      'node.upgraded': '已升级：数值 ×{mult}',
      'node.vexed': 'VEX 标记：数值 ×2',
      'node.clickToRemove': '点击节点可收回手牌。',
      'node.inputSource': '无（源）',
      'node.inputMerge': '左 / 左上 / 左下',
      'node.outputByInput': '由输入决定',
      'node.clickToSelect': '点击选中，再点网格空格放置。',
      'node.directPass': '直通',
      'node.directPassTip': '只招专才：直通 ×1 / 0h，特效无效',
      'node.upgradedBadgeTip': '升级节点：数值 ×{mult}',
      'node.vexBadgeTip': 'VEX 标记：本关数值 ×2',
      'node.vexButtonTip': 'VEX：本关把此节点标记为 ×2，每关一次',
      'node.riskBadgeTip': 'Cook 时掷骰，有 {chance}% 概率爆炸。',
      'node.sourceLabel': '源',
      'node.sumLabel': 'SUM',
      'node.rbdLabel': '×模型',

      'short.box': '盒',
      'short.sculpt': '雕',
      'short.kitbash': '拼',
      'short.scan': '扫',
      'short.pyro': '火',
      'short.flip': '流',
      'short.vellum': '布',
      'short.rbd': '碎',
      'short.keylight': '灯',
      'short.render': '渲',
      'short.hdri': 'HDRI',
      'short.lightlink': '连',
      'short.grade': '调',
      'short.roto': '抠',
      'short.keygreen': '绿',
      'short.despill': '溢',
      'short.merge': '合',

      'detail.title': '节点详情',
      'mobile.est': '预估',
      'mobile.time': '耗时',
      'mobile.risk': '爆炸',
      'mobile.cooksLeft': '剩 {n} 次',
      'ui.close': '关闭',

      'bond.title': '部门羁绊',
      'bond.effectiveNodes': '{n} 有效节点',
      'bond.modelName': 'Model ≥ 3',
      'bond.modelEffect': '所有 Model 基础值 +{n}',
      'bond.fxName': 'FX ≥ 3',
      'bond.fxEffect': '所有爆炸概率 -{n}%',
      'bond.lightingName': 'Lighting ≥ 3',
      'bond.lightingEffect': '光环 ×1.3→×1.5，Light Linking ×1.2→×1.35',
      'bond.compName': 'Comp ≥ 3',
      'bond.compEffect': '所有 Comp 节点耗时变 0',
      'bond.tapHint': '点徽章看说明',
      'bond.countLine': '当前 {dept} 有效节点 {n}/3',

      'score.title': '本关预估',
      'score.kicker': '得分',
      'score.target': '/ 目标 <b>{n}</b>',
      'score.empty': '空',
      'score.halved': ' · 减半',
      'score.specialistNote': '只招专才：本关主导部门是 <b>{dept}</b>，其他部门直通 ×1 / 0h。',
      'score.usdNote': 'USD 管线：本关第一次端口不匹配已经被放行。',
      'score.generalistNote': '有计分链不足 3 个部门，该行得分已减半。',

      'cook.title': 'Cook',
      'cook.button': 'COOK',
      'cook.kickerOver': '超预算',
      'cook.kickerReady': '就绪',
      'cook.budgetLabel': '预计耗时 / 预算',
      'cook.ready': '可以开火',
      'cook.chances': 'Cook 机会',
      'cook.chancesTip': '本关最多 {n} 次 Cook',
      'cook.maxRisk': '最高爆炸风险：<b>{chance}%</b>',
      'cook.fxBondActive': ' · FX 羁绊已生效',
      'cook.subOk': '达标即可交片；不达标还可以调整。',
      'cook.viewDeck': '查看牌组',
      'cook.howTo': '怎么玩',
      'cook.boom': 'BOOM',
      'cook.rescue': '救场 +{value}',

      'err.cooking': 'Cook 结算中…',
      'err.levelOver': '本关已经结束',
      'err.noCooksLeft': 'Cook 次数已用尽',
      'err.overBudgetNoCook': '预算超限，无法 Cook',
      'err.overBudget': '预算超限',
      'err.cannotPlace': '当前不能摆放',
      'err.cannotOperate': '当前不能操作',
      'err.badCell': '格子不存在',
      'err.cellOccupied': '格子已被占用',
      'err.cardNotInHand': '手牌里没有这张节点',
      'err.noNodeHere': '这里没有节点',
      'err.cardNotFound': '找不到节点',
      'err.noSubstep': '只有 FX 节点有 substep',
      'err.noVexRelic': '没有 VEX 遗物',
      'err.vexNotNow': '现在不能使用 VEX',
      'err.vexUsed': '本关已经用过了',
      'err.placeFirst': '先把节点放到网格上',
      'err.cannotContinue': '现在不能继续',
      'err.notRelicPhase': '现在不是选遗物阶段',
      'err.relicNotOffered': '这个遗物不在候选中',
      'err.relicOwned': '已经拥有这个遗物',
      'err.notInShop': '不在商店',
      'err.alreadyBought': '已经买过了',
      'err.noMoney': '钱不够',
      'err.noRelicToBuy': '没有可买的遗物',
      'err.alreadyOwn': '已经拥有',
      'err.deleteUsed': '本次已用过删牌服务',
      'err.keepOneCard': '牌组至少保留 1 张',
      'err.cardNotFoundShort': '找不到这张牌',
      'err.upgradeUsed': '本次已用过升级服务',
      'err.alreadyUpgraded': '这张牌已经升级过了',

      'toast.pickHandFirst': '先从手牌选一张节点。',
      'toast.vexMarked': 'VEX 已标记：本关该节点输出 ×2。',
      'toast.boughtNode': '已购入 {name}。',
      'toast.gotRelic': '已获得遗物：{name}。',
      'toast.confirmDelete': '确定删除 {name}？删牌服务不可撤销，花费 {price}。',
      'toast.deleted': '已删除 {name}。',
      'toast.upgraded': '升级完成：数值 ×{mult}。',
      'toast.rentDead': '交不起房租，游戏结束。',
      'toast.relicPicked': '获得遗物：{name}。',

      'result.kickerClear': 'COOK · 通过',
      'result.kickerResult': 'COOK 结果',
      'result.title': 'Cook 结果',
      'result.stampClear': '关卡通过',
      'result.stampFailed': '关卡失败',
      'result.stampCook': 'COOK 结果',
      'result.titleClear': '达标交片',
      'result.titleFailed': '这关没过',
      'result.titleClose': '差一点',
      'result.subSuccess': '目标 {target} 分，实际 {score} 分。客户很满意。',
      'result.subFailed': '三次 Cook 结束，这关失败。没有奖励，整装去下一家。',
      'result.subClose': '还差 {diff} 分。还可以调整节点再 Cook。',
      'result.btnOffer': '领取梦想 offer',
      'result.btnEnding': '面对结局',
      'result.btnContinue': '结算并继续',
      'result.btnAdjust': '回去调整',
      'result.statHours': '耗时 / 预算',
      'result.statCooks': 'Cook 剩余',
      'result.statDiff': '分差',
      'result.row': '第 {row} 行 · {type}',
      'result.explosion': '第 {row} 行 {name} 爆炸（{chance}% · 爆炸前 {value}）',
      'result.explosionJoin': '；',
      'result.explosionCache': '。缓存习惯保留了 50% 输出。',
      'result.explosionZero': '。该节点输出归零。',
      'result.reward': '本关奖励 <b>+{money}</b>',
      'result.portfolio': '　作品集网站 <b>+{money}</b>',
      'result.midRelic': '<br>中型工作室结算：下一步可获得 <b>三选一遗物</b>。',

      'deck.kicker': '牌组',
      'deck.title': '牌组 · {n} 张',
      'misc.cook': 'Cook',
      'deck.sub': '每关开始随机抽 {n} 张。升级会永久保留。',
      'deck.ownerHand': '手牌',
      'deck.ownerField': '场上',

      'help.kicker': '玩法说明',
      'help.title': '怎么玩',
      'help.sub': '色块原型 · 不需要美术，也不需要服务器。',
      'help.b1.title': '1. 摆节点',
      'help.b1.p1': '点手牌选中，再点网格空格放置。点场上节点会打开详情，并可拿回手牌。FX 节点上的 <b>− / +</b> 调整 substep。',
      'help.b1.p2': '数据从左往右流。空格子相当于导线：节点会连到同一行左边最近的节点，每行<b>最右边</b>的节点输出进入输出口；只有输出类型等于公司要求的类型才计分。',
      'help.b2.title': '2. 端口匹配',
      'help.b2.p1': '每个节点只接受特定输入；左邻输出类型不匹配时线会断开（红色虚线）。源节点（Model）不需要输入。',
      'help.b2.p2': '端口：<span style="color:#9aa4b3">■ geo</span> · <span style="color:#ff9349">▲ sim</span> · <span style="color:#4d9dff">● render</span> · <span style="color:#ffd166">◆ final</span>。',
      'help.b3.title': '3. Cook',
      'help.b3.p1': '点 COOK 后数值沿连线流动。FX 节点可能爆炸，输出归零、下游断流。预算超限时不能 Cook；每关默认 3 次机会，达标即可过关。',
      'help.b3.p2': 'Cook 次数用完仍未达标 = 这关失败，没有奖励，但会继续下一关。',
      'help.b4.title': '4. 六个月的生存',
      'help.b4.p1': '开局 $4000，每月开始扣房租 $1000。每个月三关：零活 / 中型工作室 / Boss 梦想公司。存款 < 0 立即饿死。',
      'help.b4.p2': '中型达标可三选一遗物；每关结束可进商店买节点、遗物、删牌或升级。',
      'help.b5.title': '部门机制',
      'help.b5.html': '<ul><li><b>Model</b>：源，纵列堆叠；Kitbash 吃同列其他 Model。</li><li><b>FX</b>：substep 赌博，倍率/耗时/爆炸率一起涨。</li><li><b>Lighting</b>：光环加成同列上下相邻的非 Lighting 节点。</li><li><b>Comp</b>：链越长越强；Roto 可救回上游爆炸前 60% 的值。</li></ul>',
      'help.b6.title': '羁绊与通用',
      'help.b6.p1': '网格上有效参与节点数达到 3，就会触发同部门羁绊（见右侧）。',
      'help.b6.p2': '<b>Merge</b> 收左 / 左上 / 左下三路输入，求和后按来源链里的不同部门数乘算，输出最靠后的类型。',

      'relic.kicker': '遗物奖励',
      'relic.title': '中型工作室 · 三选一遗物',
      'relic.sub': '{company} 很欣赏你的作品。选一件带进下一关。',
      'relic.foot': '遗物不会重复获得，效果永久生效。',

      'shop.kicker': '收工商店',
      'shop.title': '{company} · 资产商店',
      'shop.summarySuccess': '本关达标 +{money}',
      'shop.summaryFail': '本关失败 · 无奖励',
      'shop.summaryScore': '{score} / {target} 分',
      'shop.summaryDefault': '关卡结算',
      'shop.wallet': '钱包',
      'shop.cash': '可用现金',
      'shop.note': '删牌 / 升级各一次<br>节点可以买多张',
      'shop.nodesTitle': '节点现货 · NODE OFFERS',
      'shop.relicTitle': '遗物 · RELIC',
      'shop.servicesTitle': '服务 · SERVICES',
      'shop.deleteService': '删牌',
      'shop.upgradeService': '升级节点',
      'shop.used': '已使用',
      'shop.unused': '未使用',
      'shop.serviceNote': '删牌与升级在右侧牌组列表中直接选择目标。',
      'shop.deckTitle': '你的牌组 · DECK ({n})',
      'shop.legend1': '删牌/升级服务每次商店各限一次',
      'shop.legend2': '灰色按钮 = 不可用',
      'shop.leave': '离开商店 →',
      'shop.buy': '购买',
      'shop.boughtNode': '已买',
      'shop.boughtRelic': '已购',
      'shop.noRelic': '本店没有可购买的遗物了。',
      'shop.deleteBtn': '删 {price}',
      'shop.upgradeBtn': '升 {price}',
      'shop.deleteTitle': '删牌 {price}',
      'shop.upgradeTitle': '升级 {price}',
      'shop.next': '下一关：第 {month} 月 · 第 {slot}/3 关 · {tier}',
      'shop.nextRent': ' · 将扣房租 {money}',
      'shop.lastCompany': '这是最后一家公司。',
      'shop.offerTip': '{name}\n{desc}\n价格 {money}',

      'end.deadTitle': '饿死街头',
      'end.deadCopy': '存款 < 0，房租和盒饭都不等人。',
      'end.broke': '存款 < 0，游戏结束。',
      'end.victoryTitle': '梦想 OFFER',
      'end.victoryCopy': '第六个月的 Boss 也点头了。你终于把作品投进了 {company}，明天开始交真正的片子。',
      'end.noOfferTitle': '六个月过去了',
      'end.noOfferCopy': '你熬过了六个月，却没有拿到梦想公司的 offer。作品还在，下一轮招聘也还会来。',
      'end.letterTitle': '录用信 / Offer Letter',
      'end.letterGreeting': '致我们的下一位 VFX 艺术家：',
      'end.letterBody': '我们看了你的节点、你的缓存、以及你在预算里做出来的那些不可能。{company} 正式邀请你加入。',
      'end.letterSalary': '薪资面议，房租有人分担。',
      'end.letterSig': '— {company} · 招聘组',
      'end.finalMoney': '最终存款',
      'end.monthReached': '到达月份',
      'end.monthValue': '第 {n} 月',
      'end.levelsCleared': '完成关卡',
      'end.restart': '重新开始六个月',
      'end.dreamCompany': '梦想公司',
      'end.rentStart': '开局交不起房租，饿死街头。',
      'end.rentMonth': '新一个月交不起房租，游戏结束。'
    }
  };

  function normalizeLang(lang) {
    return lang === 'zh' ? 'zh' : 'en';
  }

  /* 取界面文字。key 不存在时回退到英文，再回退到 key 本身。 */
  function t(key, lang) {
    const l = normalizeLang(lang);
    const table = I18N[l] || I18N[DEFAULT_LANG];
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (Object.prototype.hasOwnProperty.call(I18N.en, key)) return I18N.en[key];
    return key;
  }

  /* 构造双语文字：loc('Box', '盒子') → { en: 'Box', zh: '盒子' } */
  function loc(en, zh) {
    return { en: en, zh: zh };
  }

  /* 取数据表里的双语文字；传普通字符串时原样返回。 */
  function L(value, lang) {
    if (value == null) return '';
    if (typeof value === 'object') {
      const l = normalizeLang(lang);
      if (value[l] != null) return String(value[l]);
      if (value.en != null) return String(value.en);
      if (value.zh != null) return String(value.zh);
    }
    return String(value);
  }

  /* ================================================================
   * 3. 数据表
   * ================================================================ */
  const PORTS = {
    geo:    { id: 'geo',    name: loc('Geo', '几何'),       color: '#9aa4b3', shape: 'square', rank: 0 },
    sim:    { id: 'sim',    name: loc('Sim', '模拟'),       color: '#ff9349', shape: 'triangle', rank: 1 },
    render: { id: 'render', name: loc('Render', '渲染图'),  color: '#4d9dff', shape: 'circle', rank: 2 },
    final:  { id: 'final',  name: loc('Final', '成片'),     color: '#ffd166', shape: 'diamond', rank: 3 }
  };
  const PORT_ORDER = ['geo', 'sim', 'render', 'final'];

  const DEPARTMENTS = {
    model:    { id: 'model',    name: loc('Model', '模型'),    color: '#7f8997', text: '#eef1f5' },
    fx:       { id: 'fx',       name: loc('FX', '特效'),       color: '#e97932', text: '#fff7ef' },
    lighting: { id: 'lighting', name: loc('Lighting', '灯光'), color: '#337fd6', text: '#eff7ff' },
    comp:     { id: 'comp',     name: loc('Comp', '合成'),     color: '#9561dc', text: '#fbf5ff' },
    merge:    { id: 'merge',    name: loc('Universal', '通用'), color: '#e8e8e8', text: '#20242a' }
  };

  /* 节点表：mult = 输入 × mult；flat = 输入 + flat；base = 源基础值。
     所有时长、倍率都集中在这里，方便平衡。 */
  const NODE_DEFS = {
    box: {
      type: 'box', name: loc('Box', '盒子'), dept: 'model', input: [], output: 'geo',
      source: true, base: 10, hours: 1,
      desc: loc(
        'Basic model source. Outputs 10 geo. More Model nodes in the column make the Model bond easier to trigger.',
        '基础模型源。输出 10 几何。同列的 Model 节点越多，越容易触发 Model 羁绊。'
      )
    },
    sculpt: {
      type: 'sculpt', name: loc('Sculpt', '雕刻'), dept: 'model', input: [], output: 'geo',
      source: true, base: 25, hours: 3,
      desc: loc(
        'High-poly source. Outputs 25 geo, takes 3h.',
        '高模源。输出 25 几何，耗时 3h。'
      )
    },
    kitbash: {
      type: 'kitbash', name: loc('Kitbash', '拼装'), dept: 'model', input: [], output: 'geo',
      source: true, base: 8, hours: 1, perOtherModel: 12,
      desc: loc(
        'Kitbash source. Base 8; +12 for every other Model node in the column. The backbone of vertical stacking.',
        '拼装源。基础 8，同列每有一个其他 Model 节点 +12。是纵向堆叠的核心。'
      )
    },
    scan: {
      type: 'scan', name: loc('Scan', '扫描'), dept: 'model', input: [], output: 'geo',
      source: true, base: 15, hours: 2, adjacentLightingMultiplier: 2,
      desc: loc(
        'Scan source. Base 15; ×2 when a Lighting node sits directly above or below in the column.',
        '扫描源。基础 15；同列上下相邻有 Lighting 节点时 ×2。'
      )
    },

    pyro: {
      type: 'pyro', name: loc('Pyro', '火焰'), dept: 'fx', input: ['geo', 'sim'], output: 'sim',
      source: false, mult: 2.5, hours: 2, substepMult: 1.4,
      desc: loc(
        'Input ×2.5, outputs sim. Raise substep to gamble for more power and time — and explosions.',
        '输入 ×2.5 输出模拟。可用 substep 赌博提高倍率和耗时，同时提高爆炸率。'
      )
    },
    flip: {
      type: 'flip', name: loc('FLIP', '流体'), dept: 'fx', input: ['geo', 'sim'], output: 'sim',
      source: false, mult: 2, hours: 2, substepMult: 1.6,
      desc: loc(
        'Input ×2, outputs sim. Each substep adds ×1.6 (higher than other FX nodes\' 1.4).',
        '输入 ×2 输出模拟。substep 每级额外 ×1.6（比其他 FX 的 1.4 更高）。'
      )
    },
    vellum: {
      type: 'vellum', name: loc('Vellum', '布料'), dept: 'fx', input: ['geo', 'sim'], output: 'sim',
      source: false, flat: 30, hours: 1, neverExplodes: true, substepMult: 1.4,
      desc: loc(
        'Input +30, outputs sim. 1h and never explodes; substep still adds output and time.',
        '输入 +30 输出模拟。1h，永不爆炸；substep 仍会增加输出和耗时。'
      )
    },
    rbd: {
      type: 'rbd', name: loc('RBD', '破碎'), dept: 'fx', input: ['geo', 'sim'], output: 'sim',
      source: false, hours: 2, substepMult: 1.4, rbdPerModel: 0.5,
      desc: loc(
        'Input ×(1 + 0.5 × upstream Model nodes in this row), outputs sim.',
        '输入 ×(1 + 0.5 × 本行上游 Model 数)，输出模拟。'
      )
    },

    keylight: {
      type: 'keylight', name: loc('Key Light', '主光'), dept: 'lighting', input: ['geo', 'sim'], output: 'render',
      source: false, mult: 1.5, hours: 1, aura: 1.3, auraKind: 'key',
      desc: loc(
        'Input ×1.5, outputs render. Aura: non-Lighting nodes directly above/below in the column ×1.3 (×1.5 with the Lighting bond).',
        '输入 ×1.5 输出渲染图。光环：同列上下相邻的非 Lighting 节点输出 ×1.3（Lighting 羁绊后 ×1.5）。'
      )
    },
    render: {
      type: 'render', name: loc('Render', '渲染'), dept: 'lighting', input: ['geo', 'sim'], output: 'render',
      source: false, mult: 2, hours: 4,
      desc: loc(
        'Input ×2, outputs render. Heavy: 4h; an adjacent Light Linking cuts its time.',
        '输入 ×2 输出渲染图。重，4h；相邻 Light Linking 可减耗时。'
      )
    },
    hdri: {
      type: 'hdri', name: loc('HDRI', '环境光'), dept: 'lighting', input: ['geo', 'sim'], output: 'render',
      source: false, mult: 1.2, hours: 1, sameColumnLightingMult: 1.5,
      desc: loc(
        'Input ×1.2, outputs render. ×1.5 more when other Lighting nodes share the column.',
        '输入 ×1.2 输出渲染图。同列还有其他 Lighting 节点时自身额外 ×1.5。'
      )
    },
    lightlink: {
      type: 'lightlink', name: loc('Light Linking', '灯光链接'), dept: 'lighting', input: ['geo', 'sim'], output: 'render',
      source: false, mult: 1, hours: 1, aura: 1.2, auraKind: 'link', renderHoursReduction: 2,
      desc: loc(
        'Input ×1, outputs render. Aura: non-Lighting neighbors ×1.2 (×1.35 with bond); adjacent Render in the column -2h.',
        '输入 ×1 输出渲染图。光环：同列上下相邻的非 Lighting 节点输出 ×1.2（羁绊后 ×1.35）；同列相邻 Render 耗时 -2h。'
      )
    },

    grade: {
      type: 'grade', name: loc('Grade', '调色'), dept: 'comp', input: ['render', 'final'], output: 'final',
      source: false, hours: 1, gradePerUpstream: 0.15,
      desc: loc(
        'Input ×(1 + 0.15 × total upstream nodes in this row), outputs final. Longer chains hit harder.',
        '输入 ×(1 + 0.15 × 本行上游节点总数)，输出成片。链越长越强。'
      )
    },
    roto: {
      type: 'roto', name: loc('Roto', '抠像'), dept: 'comp', input: ['render', 'final'], output: 'final',
      source: false, flat: 20, hours: 2, rescuePercent: 0.6,
      desc: loc(
        'Input +20, outputs final. If something upstream explodes, recovers 60% of its pre-explosion value, then +20.',
        '输入 +20 输出成片。若本行上游有节点爆炸，会把该爆炸前值的 60% 救回来再 +20。'
      )
    },
    keygreen: {
      type: 'keygreen', name: loc('Keyer', '绿幕'), dept: 'comp', input: ['render', 'final'], output: 'final',
      source: false, flat: 40, hours: 1,
      desc: loc(
        'Adds a live-action plate: input +40, outputs final.',
        '输入 +40（加入实拍素材），输出成片。'
      )
    },
    despill: {
      type: 'despill', name: loc('Despill', '去溢色'), dept: 'comp', input: ['render', 'final'], output: 'final',
      source: false, mult: 1.3, flat: 0, hours: 1, adjacentCompBonus: 10,
      desc: loc(
        'Input ×1.3, outputs final. +10 for each adjacent Comp node.',
        '输入 ×1.3 输出成片；每有一个紧挨着的 Comp 节点，额外 +10。'
      )
    },

    merge: {
      type: 'merge', name: loc('Merge', '合并'), dept: 'merge', input: [], output: null,
      source: false, hours: 1, special: 'merge',
      desc: loc(
        'Takes left, top-left and bottom-left. Sums inputs, then ×(1 + 0.25 × distinct departments in the source chains). Outputs the highest-ranked input type (geo<sim<render<final).',
        '输入左、左上、左下三个格子；数值相加，再 ×(1 + 0.25 × 输入来源链中的不同部门数)。输出类型取最靠后的输入类型（geo<sim<render<final）。'
      )
    }
  };
  const NODE_TYPES = Object.keys(NODE_DEFS);

  const RELICS = {
    houdini: {
      id: 'houdini', name: loc('Houdini Mastery', 'Houdini 精通'), icon: '**',
      desc: loc('FX nodes take 1h less (minimum 1h).', 'FX 节点耗时 -1h（最低 1h）。')
    },
    vex: {
      id: 'vex', name: loc('VEX', 'VEX'), icon: '{ }',
      desc: loc(
        'Once per level, mark a placed node at ×2 (the VEX button on the node).',
        '每关可以把一个已放置节点标记为 ×2（节点上的 VEX 按钮，每关一次）。'
      )
    },
    usd: {
      id: 'usd', name: loc('USD Pipeline', 'USD 管线'), icon: 'USD',
      desc: loc('The first port mismatch each level still connects.', '每关第一处端口不匹配也视为能连。')
    },
    cache: {
      id: 'cache', name: loc('Cache Habit', '缓存习惯'), icon: '▣',
      desc: loc('Explosions keep 50% of the output instead of zero.', '节点爆炸时保留 50% 输出而不是 0。')
    },
    nuke: {
      id: 'nuke', name: loc('Nuke Hotkeys', 'Nuke 快捷键'), icon: 'N',
      desc: loc('Comp nodes take 0h.', 'Comp 节点耗时变为 0。')
    },
    mentor: {
      id: 'mentor', name: loc('Mentor', '导师'), icon: '★',
      desc: loc('+1 Cook per level.', '每关多 1 次 Cook。')
    },
    caffeine: {
      id: 'caffeine', name: loc('Caffeine Dependency', '咖啡因依赖'), icon: '☕',
      desc: loc('+3h budget, but rent costs $200 more each month.', '预算 +3h，但每月房租 +$200。')
    },
    portfolio: {
      id: 'portfolio', name: loc('Portfolio Site', '作品集网站'), icon: 'WWW',
      desc: loc('+$100 extra for every level you clear.', '每过一关额外 +$100。')
    }
  };
  const RELIC_IDS = Object.keys(RELICS);

  const RULES = {
    none: {
      id: 'none', name: loc('No Special Rules', '无特殊规则'),
      desc: loc('Normal gig, normal delivery.', '正常接活，正常交片。'), hard: false
    },
    fxhouse: {
      id: 'fxhouse', name: loc('FX House', 'FX 专门店'),
      desc: loc('This job wants sim output. FX nodes output ×1.5.', '本关要求输出 sim。FX 节点输出 ×1.5。'), hard: false,
      targetOutput: 'sim'
    },
    adagency: {
      id: 'adagency', name: loc('Ad Agency', '广告公司'),
      desc: loc('This job wants final output.', '本关要求输出 final（成片）。'), hard: false,
      targetOutput: 'final'
    },
    lightingjob: {
      id: 'lightingjob', name: loc('Lighting Position', 'Lighting 职位'),
      desc: loc('This job wants render output. Lighting auras are doubled.', '本关要求输出 render。Lighting 光环倍率翻倍。'), hard: false,
      targetOutput: 'render'
    },
    generalist: {
      id: 'generalist', name: loc('Generalist Wanted', '要全面的人'),
      desc: loc('Any scoring row with fewer than 3 departments is halved.', '每条计分的链若少于 3 个不同部门，该行得分减半。'), hard: true
    },
    specialist: {
      id: 'specialist', name: loc('Specialist Only', '只招专才'),
      desc: loc(
        'Besides Model, only the most common department on the grid stays effective; other departments pass through at ×1 and 0h.',
        '除 Model 外，只有网格上出现最多的那个部门的节点有效；其他部门节点视为直通 ×1、0h。'
      ), hard: true
    },
    renderfarm: {
      id: 'renderfarm', name: loc('Render Farm Crunch', '渲染农场紧张'),
      desc: loc('Cook budget -3h this level.', '本关 Cook 预算 -3h。'), hard: true
    },
    clientchange: {
      id: 'clientchange', name: loc('Client Changed Their Mind', '客户改需求'),
      desc: loc('Only 2 Cooks this level.', '本关 Cook 次数只有 2 次。'), hard: true
    },
    outsource: {
      id: 'outsource', name: loc('Outsourcing Giant', '外包大厂'),
      desc: loc("Target score ×0.8, but this level's reward is halved.", '目标分 ×0.8，但本关奖励减半。'), hard: false
    }
  };

  const COMPANY_NAMES = {
    side: [
      loc('Sunset Shorts', '日暮短片社'),
      loc('Blue Pencil Studio', '蓝铅笔工作室'),
      loc('Wild Frame Animation', '野生帧动画'),
      loc('Asteroid Post', '小行星后期'),
      loc('White Noise Ads', '白噪音广告'),
      loc('Evening Breeze Trailers', '晚风预告片')
    ],
    mid: [
      loc('Thundercloud VFX', '雷云视效'),
      loc('Refraction Pictures', '折光影像'),
      loc('Wilderness Comp', '荒野合成'),
      loc('Behind the Screen', '银幕之后'),
      loc('Orbit Media', '轨道传媒'),
      loc('Glass Sea Studio', '玻璃海工作室')
    ],
    boss: [
      loc('Starring Pictures', '星环影业'),
      loc('Colossus Entertainment', '巨像娱乐'),
      loc('Skyline Studios', '天际线影业')
    ]
  };

  /* ================================================================
   * 4. 基础工具
   * ================================================================ */
  let uidCounter = 0;

  function makeRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seed) {
    if (typeof seed === 'function') return seed;
    return makeRng(seed == null ? (Date.now() ^ (Math.random() * 0xffffffff)) : seed);
  }

  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

  function makeCard(type, opts) {
    const def = NODE_DEFS[type];
    if (!def) throw new Error('Unknown node type: ' + type);
    opts = opts || {};
    uidCounter += 1;
    return {
      uid: 'c' + uidCounter,
      type: type,
      upgraded: !!opts.upgraded,
      substep: clamp(opts.substep == null ? 1 : opts.substep, 1, 4),
      vexed: !!opts.vexed
    };
  }

  function emptyGrid() {
    return [
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null]
    ];
  }

  function normalizeGrid(grid) {
    const out = emptyGrid();
    if (!grid) return out;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const v = grid[r] && grid[r][c];
        if (!v) continue;
        if (typeof v === 'string') {
          out[r][c] = { uid: 'tmp-' + r + '-' + c, type: v, upgraded: false, substep: 1, vexed: false };
        } else {
          out[r][c] = v;
        }
      }
    }
    return out;
  }

  function cardDef(card) { return NODE_DEFS[card.type]; }
  function cardSubstep(card) { return clamp(Number(card.substep) || 1, 1, 4); }
  function isUpgraded(card) { return !!(card && card.upgraded); }

  function toSet(v) {
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v);
    return new Set();
  }

  function explosionChance(substep, fxBond) {
    const base = [0, 15, 35, 60][clamp(substep, 1, 4) - 1];
    return Math.max(0, base - (fxBond ? CONFIG.fxBondExplosionReduction * 100 : 0));
  }

  function getRule(ruleId) { return RULES[ruleId] || RULES.none; }

  /* ================================================================
   * 5. 关卡生成
   * ================================================================ */
  function chooseWeighted(rng, items) {
    const total = sum(items.map(function (x) { return x.w; }));
    let roll = rng() * total;
    for (const it of items) {
      roll -= it.w;
      if (roll <= 0) return it.v;
    }
    return items[items.length - 1].v;
  }

  function generateLevels(rng) {
    rng = createRng(rng);
    const levels = [];
    const rulePool = Object.keys(RULES).filter(function (id) { return id !== 'none'; });
    const hardPool = rulePool.filter(function (id) { return RULES[id].hard; });

    for (let i = 0; i < CONFIG.months * CONFIG.levelsPerMonth; i++) {
      const slot = i % CONFIG.levelsPerMonth; // 0 零活 / 1 中型 / 2 Boss
      const tier = slot === 0 ? 'side' : (slot === 1 ? 'mid' : 'boss');
      const month = Math.floor(i / CONFIG.levelsPerMonth) + 1;

      let ruleId;
      if (tier === 'boss') {
        ruleId = pick(rng, hardPool);
      } else {
        ruleId = chooseWeighted(rng, [
          { v: 'none', w: 2.4 },
          { v: 'fxhouse', w: 1 },
          { v: 'adagency', w: 0.8 },
          { v: 'lightingjob', w: 1 },
          { v: 'generalist', w: 0.75 },
          { v: 'specialist', w: 0.75 },
          { v: 'renderfarm', w: 0.9 },
          { v: 'clientchange', w: 0.75 },
          { v: 'outsource', w: 1 }
        ]);
      }
      const rule = getRule(ruleId);

      let targetOutput;
      if (rule.targetOutput) {
        targetOutput = rule.targetOutput;
      } else if (tier === 'boss') {
        targetOutput = chooseWeighted(rng, [
          { v: 'sim', w: 0.1 }, { v: 'render', w: 0.25 }, { v: 'final', w: 0.65 }
        ]);
      } else if (tier === 'mid') {
        targetOutput = chooseWeighted(rng, [
          { v: 'sim', w: 0.2 }, { v: 'render', w: 0.3 }, { v: 'final', w: 0.5 }
        ]);
      } else {
        targetOutput = chooseWeighted(rng, [
          { v: 'sim', w: 0.34 }, { v: 'render', w: 0.33 }, { v: 'final', w: 0.33 }
        ]);
      }

      let targetScore = Math.round(CONFIG.targetBase * Math.pow(CONFIG.targetGrowth, i));
      if (tier === 'boss') targetScore = Math.round(targetScore * CONFIG.bossTargetMultiplier);
      if (ruleId === 'outsource') targetScore = Math.round(targetScore * CONFIG.outsourceTargetMultiplier);

      const budget = randInt(rng, CONFIG.budgetMin, CONFIG.budgetMax);
      let rewardMoney = CONFIG.rewards[tier];
      if (ruleId === 'outsource') rewardMoney = Math.floor(rewardMoney * CONFIG.outsourceRewardMultiplier);

      const companyName = pick(rng, COMPANY_NAMES[tier]);
      levels.push({
        index: i,
        month: month,
        slot: slot + 1,
        tier: tier,
        companyName: companyName,
        companySlogan: tier === 'boss'
          ? loc('Dream Studio · Final Interview', '梦想公司 · 最终面试')
          : (tier === 'mid' ? loc('Mid-size Studio', '中型工作室') : loc('Freelance Gig', '零活')),
        ruleId: ruleId,
        ruleName: rule.name,
        ruleDesc: rule.desc,
        targetOutput: targetOutput,
        targetScore: targetScore,
        baseBudget: budget,
        rewardMoney: rewardMoney,
        relicReward: tier === 'mid',
        clear: false,
        failed: false
      });
    }
    return levels;
  }

  /* ================================================================
   * 6. 计分 / 预览核心
   * ================================================================ */
  function evaluate(inputGrid, options) {
    options = options || {};
    const level = options.level || {};
    const ruleId = options.ruleId || level.ruleId || 'none';
    const rule = getRule(ruleId);
    const relics = toSet(options.relics || level.relics);
    const targetOutput = options.targetOutput || level.targetOutput || 'final';
    const targetScore = options.targetScore == null
      ? (level.targetScore == null ? 0 : level.targetScore)
      : options.targetScore;

    let budget = options.budget == null
      ? (level.budget == null ? (level.baseBudget == null ? 99 : level.baseBudget) : level.budget)
      : options.budget;
    if (ruleId === 'renderfarm') budget -= CONFIG.renderFarmBudgetPenalty;
    if (relics.has('caffeine')) budget += CONFIG.caffeineBudgetBonus;

    const roll = !!options.roll;
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const grid = normalizeGrid(inputGrid);

    const cells = [[], [], []];
    const placed = [];
    const deptPlaced = { model: 0, fx: 0, lighting: 0, comp: 0 };

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const card = grid[r][c];
        if (!card) { cells[r][c] = null; continue; }
        const def = cardDef(card);
        if (!def) throw new Error('Unknown node: ' + card.type);
        const cell = {
          row: r, col: c, card: card, def: def, type: card.type,
          dept: def.dept, passThrough: false, active: false,
          outputType: def.output, inputs: [], lineage: new Set(),
          hours: 0, value: 0, rawOutput: 0, supplied: false,
          inputValue: 0, exploded: false, rescued: false,
          explosionChance: 0, auraMultiplier: 1, upgraded: isUpgraded(card),
          vexed: !!card.vexed, substep: cardSubstep(card),
          _structural: true
        };
        cells[r][c] = cell;
        placed.push(cell);
        if (deptPlaced[def.dept] != null) deptPlaced[def.dept] += 1;
      }
    }

    /* --- 5.1 只招专才：决定主导部门与直通节点 --- */
    let specialistDept = null;
    if (ruleId === 'specialist') {
      let best = -1;
      ['fx', 'lighting', 'comp'].forEach(function (d) {
        if (deptPlaced[d] > best) { best = deptPlaced[d]; specialistDept = d; }
      });
    }
    for (const cell of placed) {
      cell.passThrough = ruleId === 'specialist' &&
        cell.dept !== 'model' && cell.dept !== 'merge' &&
        cell.dept !== specialistDept;
    }

    /* 空格子当直通线：左邻 = 同行左边最近的节点；输出口取每行最右边的节点 */
    function leftOf(r, c) { for (let k = c - 1; k >= 0; k--) { if (cells[r][k]) return cells[r][k]; } return null; }
    function rightmost(r) { for (let k = 5; k >= 0; k--) { if (cells[r][k]) return cells[r][k]; } return null; }

    /* --- 5.2 结构连通性（决定哪些节点算“有效参与”并触发羁绊） --- */
    const connections = [];
    let usdUsed = false;
    const usdAvailable = relics.has('usd');

    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 3; r++) {
        const cell = cells[r][c];
        if (!cell) continue;
        const def = cell.def;
        if (def.source || (def.dept === 'model' && !def.input.length)) {
          cell.active = true;
          cell.outputType = def.output;
          cell.lineage = new Set([def.dept]);
          continue;
        }

        if (def.special === 'merge') {
          const inputRows = [r - 1, r, r + 1].filter(function (x) { return x >= 0 && x < 3; });
          const inputTypes = [];
          const lineage = new Set();
          let any = false;
          for (const rr of inputRows) {
            const src = leftOf(rr, c);
            if (!src) continue;
            const conn = {
              mode: 'merge',
              from: { row: rr, col: src.col },
              to: { row: r, col: c },
              fromType: src.outputType,
              accepted: true,
              mismatch: false,
              connected: !!src.active,
              usdRescue: false,
              sourceActive: !!src.active
            };
            connections.push(conn);
            if (src.active) {
              any = true;
              inputTypes.push(src.outputType);
              cell.inputs.push({ row: rr, col: src.col, type: src.outputType });
              src.lineage.forEach(function (d) { lineage.add(d); });
            }
          }
          cell.active = any;
          if (any) {
            cell.outputType = inputTypes.reduce(function (best, t) {
              return PORTS[t].rank > PORTS[best].rank ? t : best;
            }, inputTypes[0]);
            lineage.add('merge');
            cell.lineage = lineage;
          } else {
            cell.lineage = new Set();
          }
          continue;
        }

        const src = leftOf(r, c);
        if (!src) continue;
        const accepted = def.input.indexOf(src.outputType) !== -1;
        let connected = accepted && src.active;
        let usdRescue = false;
        if (!accepted && src.active && usdAvailable && !usdUsed) {
          usdUsed = true;
          connected = true;
          usdRescue = true;
        }
        const conn = {
          mode: cell.passThrough ? 'passthrough' : 'normal',
          from: { row: r, col: src.col },
          to: { row: r, col: c },
          fromType: src.outputType,
          accepted: accepted,
          mismatch: !accepted,
          connected: connected,
          usdRescue: usdRescue,
          sourceActive: !!src.active
        };
        connections.push(conn);
        cell._primary = conn;
        if (connected) {
          cell.active = true;
          cell.inputs.push({ row: r, col: src.col, type: src.outputType });
          if (cell.passThrough) {
            // 只招专才：其他部门保留自己的端口类型，但数值直通 ×1、不计特殊效果。
            cell.outputType = def.output;
            cell.lineage = new Set(src.lineage);
            cell.lineage.add(cell.dept);
          } else {
            cell.outputType = def.output;
            cell.lineage = new Set(src.lineage);
            if (cell.dept !== 'merge') cell.lineage.add(cell.dept);
          }
        } else {
          cell.outputType = def.output;
          cell.lineage = new Set([cell.dept]);
        }
      }
    }

    /* --- 5.3 羁绊 --- */
    const bonds = { model: 0, fx: 0, lighting: 0, comp: 0 };
    for (const cell of placed) {
      if (cell.active && bonds[cell.dept] != null) bonds[cell.dept] += 1;
    }
    const bondActive = {
      model: bonds.model >= 3,
      fx: bonds.fx >= 3,
      lighting: bonds.lighting >= 3,
      comp: bonds.comp >= 3
    };

    /* --- 5.4 耗时 --- */
    let totalHours = 0;
    for (const cell of placed) {
      const def = cell.def;
      let h = def.hours;
      if (cell.passThrough) {
        h = 0;
      } else if (def.dept === 'fx') {
        h += (cell.substep - 1) * CONFIG.substepHours;
        if (relics.has('houdini')) h = Math.max(1, h - 1);
      } else if (def.dept === 'comp') {
        if (relics.has('nuke') || bondActive.comp) h = 0;
      } else if (cell.type === 'render') {
        let reductions = 0;
        for (let rr = 0; rr < 3; rr++) {
          if (rr === cell.row) continue;
          const other = cells[rr][cell.col];
          if (other && other.type === 'lightlink' && other.active && !other.passThrough) {
            reductions += def.renderHoursReduction || 2;
          }
        }
        h = Math.max(0, h - reductions);
      }
      h = Math.max(0, h);
      cell.hours = h;
      totalHours += h;
    }

    /* --- 5.5 逐列算数值 --- */
    const rowExplosion = [null, null, null];
    const explosions = [];
    const auraSourcesByCol = [[], [], [], [], [], []];

    function addUpstreamLineage(cell, inputs) {
      const out = new Set();
      inputs.forEach(function (src) {
        if (src && src.runtimeLineage) src.runtimeLineage.forEach(function (d) { out.add(d); });
      });
      if (cell.dept !== 'merge') out.add(cell.dept);
      return out;
    }

    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 3; r++) {
        const cell = cells[r][c];
        if (!cell) continue;
        if (!cell.active) {
          cell.supplied = false;
          cell.value = 0;
          cell.rawOutput = 0;
          cell.runtimeLineage = new Set(cell.lineage || []);
          continue;
        }

        const def = cell.def;
        const connectedInputs = [];
        let inputValue = 0;
        let supplied = false;

        if (def.source) {
          supplied = true;
          cell.runtimeLineage = new Set([cell.dept]);
        } else if (def.special === 'merge') {
          const rows = [r - 1, r, r + 1].filter(function (x) { return x >= 0 && x < 3; });
          for (const rr of rows) {
            const src = leftOf(rr, c);
            if (src && src.supplied) {
              connectedInputs.push(src);
              inputValue += src.value;
            }
          }
          supplied = connectedInputs.length > 0;
          cell.runtimeLineage = supplied ? addUpstreamLineage(cell, connectedInputs) : new Set();
        } else {
          const conn = cell._primary;
          const src = leftOf(r, c);
          if (conn && conn.connected && src && src.supplied) {
            connectedInputs.push(src);
            inputValue = src.value;
            supplied = true;
          }
          if (!supplied && cell.type === 'roto' && rowExplosion[r]) {
            const boom = rowExplosion[r];
            inputValue = boom.preValue * def.rescuePercent;
            supplied = true;
            cell.rescued = true;
            cell.rescueFrom = { row: boom.row, col: boom.col, preValue: boom.preValue };
            cell.runtimeLineage = new Set(cell.lineage || []);
          }
          if (supplied) {
            cell.runtimeLineage = addUpstreamLineage(cell, connectedInputs);
          } else {
            cell.runtimeLineage = new Set();
          }
        }

        cell.inputValue = inputValue;
        if (!supplied) {
          cell.supplied = false;
          cell.rawOutput = 0;
          cell.value = 0;
          continue;
        }

        let out = 0;
        const type = cell.type;

        if (cell.passThrough) {
          out = inputValue;
        } else if (def.source || cell.dept === 'model') {
          if (type === 'box' || type === 'sculpt' || type === 'scan') {
            out = def.base;
            if (bondActive.model) out += CONFIG.modelBondBonus;
            if (type === 'scan') {
              const hasAdjLight = [r - 1, r + 1].some(function (rr) {
                if (rr < 0 || rr > 2) return false;
                const n = cells[rr][c];
                return n && n.dept === 'lighting' && n.active;
              });
              if (hasAdjLight) out *= def.adjacentLightingMultiplier;
            }
          } else if (type === 'kitbash') {
            let others = 0;
            for (let rr = 0; rr < 3; rr++) {
              if (rr === r) continue;
              const n = cells[rr][c];
              if (n && n.dept === 'model') others += 1;
            }
            out = def.base + others * def.perOtherModel;
            if (bondActive.model) out += CONFIG.modelBondBonus;
          }
        } else if (def.special === 'merge') {
          const depts = new Set();
          connectedInputs.forEach(function (src) {
            src.runtimeLineage.forEach(function (d) {
              if (DEPARTMENTS[d]) depts.add(d);
            });
          });
          out = inputValue * (1 + CONFIG.mergeDeptBonus * depts.size);
        } else if (cell.dept === 'fx') {
          if (def.rbdPerModel != null) {
            let models = 0;
            for (let cc = 0; cc < c; cc++) {
              const n = cells[r][cc];
              if (n && n.dept === 'model') models += 1;
            }
            out = inputValue * (1 + def.rbdPerModel * models);
          } else if (def.flat != null) {
            out = inputValue + def.flat;
          } else {
            out = inputValue * def.mult;
          }
          out *= Math.pow(def.substepMult, cell.substep - 1);
          if (ruleId === 'fxhouse') out *= 1.5;
        } else if (cell.dept === 'lighting') {
          out = inputValue * def.mult;
          if (type === 'hdri') {
            const otherLighting = [r - 1, r + 1].some(function (rr) {
              if (rr < 0 || rr > 2) return false;
              const n = cells[rr][c];
              return n && n.dept === 'lighting' && n !== cell && n.active;
            });
            if (otherLighting) out *= def.sameColumnLightingMult;
          }
        } else if (cell.dept === 'comp') {
          if (type === 'grade') {
            let upstreamCount = 0;
            for (let cc = 0; cc < c; cc++) {
              if (cells[r][cc]) upstreamCount += 1;
            }
            out = inputValue * (1 + def.gradePerUpstream * upstreamCount);
          } else if (type === 'roto') {
            out = inputValue + def.flat;
          } else if (type === 'keygreen') {
            out = inputValue + def.flat;
          } else if (type === 'despill') {
            let adjacentComp = 0;
            const neigh = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
            neigh.forEach(function (p) {
              if (p[0] < 0 || p[0] > 2 || p[1] < 0 || p[1] > 5) return;
              const n = cells[p[0]][p[1]];
              if (n && n.dept === 'comp' && n !== cell) adjacentComp += 1;
            });
            out = inputValue * def.mult + adjacentComp * def.adjacentCompBonus;
          }
        }

        if (!cell.passThrough) {
          if (cell.upgraded) out *= CONFIG.upgradeMultiplier;
          if (cell.vexed) out *= 2;
        }
        cell.rawOutput = out;

        if (cell.dept === 'fx' && !def.neverExplodes && !cell.passThrough) {
          cell.explosionChance = explosionChance(cell.substep, bondActive.fx);
          if (roll && cell.explosionChance > 0 && rng() * 100 < cell.explosionChance) {
            cell.exploded = true;
            cell.preExplosionValue = out;
            rowExplosion[r] = {
              row: r, col: c, preValue: out, type: cell.type
            };
            explosions.push({
              row: r, col: c, preValue: out,
              chance: cell.explosionChance, type: cell.type
            });
            if (relics.has('cache')) {
              out = out * 0.5;
            } else {
              out = 0;
            }
          }
        }

        cell.value = out;
        cell.supplied = !cell.exploded || (relics.has('cache') && out > 0);

        if (cell.supplied && cell.value > 0 && (type === 'keylight' || type === 'lightlink') && !cell.passThrough) {
          auraSourcesByCol[c].push(cell);
        }
      }

      /* --- 本列光环结算（同一列结算完后应用） --- */
      const colAuraSources = auraSourcesByCol[c];
      if (colAuraSources.length) {
        for (let r = 0; r < 3; r++) {
          const target = cells[r][c];
          if (!target || !target.supplied || target.dept === 'lighting' || target.passThrough) continue;
          for (const src of colAuraSources) {
            if (Math.abs(src.row - target.row) !== 1) continue;
            let factor = src.def.aura || 1;
            if (bondActive.lighting) {
              factor = src.def.auraKind === 'link' ? CONFIG.lightingLinkBondAura : CONFIG.lightingBondAura;
            }
            if (ruleId === 'lightingjob') factor *= 2;
            target.value *= factor;
            target.auraMultiplier *= factor;
          }
        }
      }
    }

    /* --- 5.6 输出口与计分 --- */
    const rowResults = [];
    let rawTotal = 0;
    let scoreCount = 0;
    for (let r = 0; r < 3; r++) {
      const cell = rightmost(r);
      let score = 0;
      let targetMatch = false;
      let halved = false;
      let chainDepts = [];
      if (cell && cell.supplied && cell.value > 0 && cell.outputType === targetOutput) {
        score = cell.value;
        targetMatch = true;
        chainDepts = Array.from(cell.runtimeLineage || []).filter(function (d) { return !!DEPARTMENTS[d] && d !== 'merge'; });
        if (ruleId === 'generalist' && new Set(chainDepts).size < 3) {
          score *= 0.5;
          halved = true;
        }
        if (score > 0) scoreCount += 1;
      } else if (cell) {
        chainDepts = Array.from(cell.runtimeLineage || []).filter(function (d) { return !!DEPARTMENTS[d] && d !== 'merge'; });
      }
      rawTotal += score;
      rowResults.push({
        row: r,
        hasNode: !!cell,
        outputType: cell ? cell.outputType : null,
        value: cell ? cell.value : 0,
        supplied: !!(cell && cell.supplied),
        targetMatch: targetMatch,
        chainDepts: chainDepts,
        generalistHalved: halved,
        score: score
      });
    }

    const displayTotal = Math.round(rawTotal);
    const overBudget = totalHours > budget + 1e-9;
    const success = displayTotal >= targetScore;

    /* --- 输出口连线 --- */
    const outputConnections = [];
    for (let r = 0; r < 3; r++) {
      const cell = rightmost(r);
      if (!cell) continue;
      outputConnections.push({
        row: r,
        from: { row: r, col: cell.col },
        fromType: cell.outputType,
        targetOutput: targetOutput,
        connected: !!cell.supplied,
        typeMatch: cell.outputType === targetOutput
      });
    }

    return {
      grid: grid,
      cells: cells,
      placed: placed,
      connections: connections,
      outputConnections: outputConnections,
      rows: rowResults,
      rowResults: rowResults,
      bonds: bonds,
      bondActive: bondActive,
      specialistDept: specialistDept,
      usdUsed: usdUsed,
      targetOutput: targetOutput,
      targetScore: targetScore,
      ruleId: ruleId,
      ruleName: rule.name,
      budget: budget,
      baseBudget: options.budget == null ? (level.baseBudget == null ? level.budget : level.baseBudget) : options.budget,
      hours: totalHours,
      totalHours: totalHours,
      overBudget: overBudget,
      canCook: !overBudget,
      blockReason: overBudget ? 'err.overBudget' : null,
      totalScore: rawTotal,
      displayTotal: displayTotal,
      scoreCount: scoreCount,
      success: success,
      explosions: explosions,
      explosionCount: explosions.length,
      rolled: roll,
      relics: Array.from(relics),
      hoursByCell: cells.map(function (row) { return row.map(function (c) { return c ? c.hours : null; }); }),
      values: cells.map(function (row) { return row.map(function (c) { return c ? round2(c.value) : null; }); }),
      types: cells.map(function (row) { return row.map(function (c) { return c ? c.outputType : null; }); })
    };
  }

  function preview(grid, options) {
    const opts = Object.assign({}, options || {}, { roll: false });
    return evaluate(grid, opts);
  }

  function cookBoard(grid, options) {
    const opts = Object.assign({}, options || {}, { roll: true });
    return evaluate(grid, opts);
  }

  /* ================================================================
   * 7. 整局游戏状态机
   * ================================================================ */
  class Game {
    constructor(opts) {
      opts = opts || {};
      this.seed = opts.seed == null ? (Date.now() >>> 0) : opts.seed;
      this.rng = createRng(opts.rng || this.seed);
      this.newGame();
    }

    newGame() {
      this.levels = generateLevels(this.rng);
      this.state = {
        money: CONFIG.startingMoney,
        month: 1,
        levelIndex: 0,
        levels: this.levels,
        deck: CONFIG.startingDeck.map(function (t) { return makeCard(t); }),
        hand: [],
        grid: emptyGrid(),
        relics: [],
        phase: 'playing',
        status: 'playing',
        cooksLeft: 0,
        cooksTotal: 0,
        attempts: 0,
        lastCook: null,
        lastLevelResult: null,
        relicChoices: [],
        shop: null,
        vexUsed: false,
        usdUsedThisLevel: false,
        notice: '',
        endedReason: null,
        selectedHand: null
      };
      // 第一个月房租
      this.state.money -= this.currentRent();
      if (this.state.money < 0) {
        this.kill('end.rentStart');
        return;
      }
      this.startLevel();
    }

    get level() { return this.levels[this.state.levelIndex]; }

    currentRent() {
      return CONFIG.rent + (this.state.relics.indexOf('caffeine') !== -1 ? CONFIG.caffeineExtraRent : 0);
    }

    hasRelic(id) { return this.state.relics.indexOf(id) !== -1; }

    cooksForLevel(level) {
      let n = level.ruleId === 'clientchange' ? CONFIG.clientChangeCooks : CONFIG.baseCooks;
      if (this.hasRelic('mentor')) n += CONFIG.mentorExtraCook;
      return n;
    }

    startLevel() {
      const s = this.state;
      if (s.levelIndex >= this.levels.length) {
        this.finishCampaign('miss');
        return;
      }
      s.grid = emptyGrid();
      s.hand = [];
      s.vexUsed = false;
      s.attempts = 0;
      s.lastCook = null;
      s.lastLevelResult = null;
      s.relicChoices = [];
      s.shop = null;
      s.phase = 'playing';
      s.status = 'playing';
      s.selectedHand = null;
      s.level = this.levels[s.levelIndex];
      s.month = s.level.month;
      s.cooksTotal = this.cooksForLevel(s.level);
      s.cooksLeft = s.cooksTotal;
      s.notice = '';
      s.deck.forEach(function (c) { c.vexed = false; });
      const shuffled = shuffle(s.deck, this.rng);
      s.hand = shuffled.slice(0, Math.min(CONFIG.handSize, shuffled.length));
      for (const c of s.hand) c.substep = clamp(c.substep || 1, 1, 4);
    }

    allCards() { return this.state.deck; }

    cardByUid(uid) {
      return this.state.deck.find(function (c) { return c.uid === uid; }) || null;
    }

    cardAt(row, col) {
      const g = this.state.grid;
      return g[row] && g[row][col] ? g[row][col] : null;
    }

    drawState() {
      const s = this.state;
      const seen = new Set();
      s.hand.forEach(function (c) { seen.add(c.uid); });
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          if (s.grid[r][c]) seen.add(s.grid[r][c].uid);
        }
      }
      return { hand: seen };
    }

    /* --- 放置 / 收回 / substep / VEX --- */
    placeCard(uid, row, col) {
      const s = this.state;
      if (s.phase !== 'playing' || s.status !== 'playing') return { ok: false, reason: 'err.cannotPlace' };
      if (row < 0 || row > 2 || col < 0 || col > 5) return { ok: false, reason: 'err.badCell' };
      if (s.grid[row][col]) return { ok: false, reason: 'err.cellOccupied' };
      const idx = s.hand.findIndex(function (c) { return c.uid === uid; });
      if (idx === -1) return { ok: false, reason: 'err.cardNotInHand' };
      const [card] = s.hand.splice(idx, 1);
      s.grid[row][col] = card;
      return { ok: true, card: card };
    }

    removeCard(row, col) {
      const s = this.state;
      if (s.phase !== 'playing' || s.status !== 'playing') return { ok: false, reason: 'err.cannotOperate' };
      const card = s.grid[row] && s.grid[row][col];
      if (!card) return { ok: false, reason: 'err.noNodeHere' };
      s.grid[row][col] = null;
      if (!s.hand.some(function (c) { return c.uid === card.uid; })) s.hand.push(card);
      return { ok: true, card: card };
    }

    setSubstep(uid, valueOrDelta, isDelta) {
      const card = this.cardByUid(uid);
      if (!card) return { ok: false, reason: 'err.cardNotFound' };
      const def = NODE_DEFS[card.type];
      if (!def || def.dept !== 'fx') return { ok: false, reason: 'err.noSubstep' };
      const before = cardSubstep(card);
      let next = isDelta ? before + Number(valueOrDelta) : Number(valueOrDelta);
      next = clamp(next, 1, 4);
      card.substep = next;
      return { ok: true, substep: next };
    }

    markVex(uid) {
      const s = this.state;
      if (!this.hasRelic('vex')) return { ok: false, reason: 'err.noVexRelic' };
      if (s.phase !== 'playing') return { ok: false, reason: 'err.vexNotNow' };
      if (s.vexUsed) return { ok: false, reason: 'err.vexUsed' };
      const card = this.cardByUid(uid);
      if (!card) return { ok: false, reason: 'err.cardNotFound' };
      let placed = false;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        if (s.grid[r][c] && s.grid[r][c].uid === uid) placed = true;
      }
      if (!placed) return { ok: false, reason: 'err.placeFirst' };
      s.deck.forEach(function (c) { c.vexed = false; });
      card.vexed = true;
      s.vexUsed = true;
      return { ok: true };
    }

    /* --- 预览 / Cook --- */
    getPreview() {
      const s = this.state;
      const level = this.level;
      if (!level) return null;
      return evaluate(s.grid, {
        ruleId: level.ruleId,
        targetOutput: level.targetOutput,
        targetScore: level.targetScore,
        budget: level.baseBudget,
        relics: s.relics,
        roll: false
      });
    }

    getBudget() {
      let b = this.level ? this.level.baseBudget : 0;
      if (this.level && this.level.ruleId === 'renderfarm') b -= CONFIG.renderFarmBudgetPenalty;
      if (this.hasRelic('caffeine')) b += CONFIG.caffeineBudgetBonus;
      return b;
    }

    canCook() {
      const s = this.state;
      if (s.phase !== 'playing' || s.status !== 'playing') return { ok: false, reason: 'err.levelOver' };
      if (s.cooksLeft <= 0) return { ok: false, reason: 'err.noCooksLeft' };
      const p = this.getPreview();
      if (p.overBudget) return { ok: false, reason: 'err.overBudget' };
      return { ok: true };
    }

    cook() {
      const s = this.state;
      const check = this.canCook();
      if (!check.ok) return { ok: false, reason: check.reason };
      const level = this.level;
      const result = evaluate(s.grid, {
        ruleId: level.ruleId,
        targetOutput: level.targetOutput,
        targetScore: level.targetScore,
        budget: level.baseBudget,
        relics: s.relics,
        roll: true,
        rng: this.rng
      });
      s.cooksLeft -= 1;
      s.attempts += 1;
      s.lastCook = result;
      s.phase = 'cooking';

      if (result.success) {
        level.clear = true;
        this.grantRewards(level);
        s.phase = 'levelEnd';
        s.lastLevelResult = {
          success: true,
          level: level,
          score: result.displayTotal,
          target: level.targetScore,
          reward: level.rewardMoney,
          portfolioBonus: this.hasRelic('portfolio') ? CONFIG.portfolioBonus : 0,
          attempts: s.attempts
        };
        if (level.relicReward) {
          s.relicChoices = this.makeRelicChoices(3);
          s.lastLevelResult.relicChoices = s.relicChoices.slice();
        }
        return { ok: true, result: result, ended: true, success: true };
      }

      if (s.cooksLeft <= 0) {
        level.failed = true;
        s.phase = 'levelEnd';
        s.lastLevelResult = {
          success: false,
          level: level,
          score: result.displayTotal,
          target: level.targetScore,
          reward: 0,
          portfolioBonus: 0,
          attempts: s.attempts
        };
        return { ok: true, result: result, ended: true, success: false };
      }

      s.phase = 'playing';
      return { ok: true, result: result, ended: false, success: false };
    }

    grantRewards(level) {
      const s = this.state;
      s.money += level.rewardMoney;
      if (this.hasRelic('portfolio')) s.money += CONFIG.portfolioBonus;
    }

    makeRelicChoices(n) {
      const owned = new Set(this.state.relics);
      const pool = RELIC_IDS.filter(function (id) { return !owned.has(id); });
      return shuffle(pool, this.rng).slice(0, Math.max(0, n || 3));
    }

    continueAfterLevel() {
      const s = this.state;
      if (s.phase !== 'levelEnd') return { ok: false, reason: 'err.cannotContinue' };
      const level = this.level;
      if (level.index >= this.levels.length - 1) {
        this.finishCampaign(level.clear ? 'victory' : 'miss');
        return { ok: true, ended: true, victory: !!level.clear };
      }
      if (level.clear && level.relicReward && s.relicChoices.length) {
        s.phase = 'relic';
        return { ok: true, phase: 'relic' };
      }
      this.openShop();
      return { ok: true, phase: 'shop' };
    }

    chooseRelic(id) {
      const s = this.state;
      if (s.phase !== 'relic') return { ok: false, reason: 'err.notRelicPhase' };
      if (s.relicChoices.indexOf(id) === -1) return { ok: false, reason: 'err.relicNotOffered' };
      if (s.relics.indexOf(id) !== -1) return { ok: false, reason: 'err.relicOwned' };
      s.relics.push(id);
      s.relicChoices = [];
      this.openShop();
      return { ok: true, relic: RELICS[id] };
    }

    openShop() {
      const s = this.state;
      const shop = {
        nodes: [],
        relic: null,
        relicBought: false,
        deleteUsed: false,
        upgradeUsed: false
      };
      const types = NODE_TYPES.slice();
      for (let i = 0; i < CONFIG.shop.nodeCount; i++) {
        const type = pick(this.rng, types);
        shop.nodes.push({
          type: type,
          price: randInt(this.rng, CONFIG.shop.nodeMin, CONFIG.shop.nodeMax),
          bought: false
        });
      }
      const owned = new Set(s.relics);
      const available = RELIC_IDS.filter(function (id) { return !owned.has(id); });
      if (available.length) {
        shop.relic = { id: pick(this.rng, available), price: CONFIG.shop.relicPrice };
      }
      s.shop = shop;
      s.phase = 'shop';
    }

    buyShopNode(index) {
      const s = this.state;
      if (s.phase !== 'shop' || !s.shop) return { ok: false, reason: 'err.notInShop' };
      const item = s.shop.nodes[index];
      if (!item || item.bought) return { ok: false, reason: 'err.alreadyBought' };
      if (s.money < item.price) return { ok: false, reason: 'err.noMoney' };
      s.money -= item.price;
      item.bought = true;
      const c = makeCard(item.type);
      s.deck.push(c);
      return { ok: true, card: c };
    }

    buyShopRelic() {
      const s = this.state;
      if (s.phase !== 'shop' || !s.shop) return { ok: false, reason: 'err.notInShop' };
      const item = s.shop.relic;
      if (!item) return { ok: false, reason: 'err.noRelicToBuy' };
      if (s.shop.relicBought) return { ok: false, reason: 'err.alreadyBought' };
      if (s.relics.indexOf(item.id) !== -1) return { ok: false, reason: 'err.alreadyOwn' };
      if (s.money < item.price) return { ok: false, reason: 'err.noMoney' };
      s.money -= item.price;
      s.relics.push(item.id);
      s.shop.relicBought = true;
      return { ok: true, relic: RELICS[item.id] };
    }

    buyDelete(uid) {
      const s = this.state;
      if (s.phase !== 'shop' || !s.shop) return { ok: false, reason: 'err.notInShop' };
      if (s.shop.deleteUsed) return { ok: false, reason: 'err.deleteUsed' };
      if (s.deck.length <= 1) return { ok: false, reason: 'err.keepOneCard' };
      const idx = s.deck.findIndex(function (c) { return c.uid === uid; });
      if (idx === -1) return { ok: false, reason: 'err.cardNotFoundShort' };
      if (s.money < CONFIG.shop.deletePrice) return { ok: false, reason: 'err.noMoney' };
      s.money -= CONFIG.shop.deletePrice;
      const removed = s.deck.splice(idx, 1)[0];
      s.shop.deleteUsed = true;
      return { ok: true, removed: removed };
    }

    buyUpgrade(uid) {
      const s = this.state;
      if (s.phase !== 'shop' || !s.shop) return { ok: false, reason: 'err.notInShop' };
      if (s.shop.upgradeUsed) return { ok: false, reason: 'err.upgradeUsed' };
      const card = this.cardByUid(uid);
      if (!card) return { ok: false, reason: 'err.cardNotFoundShort' };
      if (card.upgraded) return { ok: false, reason: 'err.alreadyUpgraded' };
      if (s.money < CONFIG.shop.upgradePrice) return { ok: false, reason: 'err.noMoney' };
      s.money -= CONFIG.shop.upgradePrice;
      card.upgraded = true;
      s.shop.upgradeUsed = true;
      return { ok: true, card: card };
    }

    leaveShop() {
      const s = this.state;
      if (s.phase !== 'shop') return { ok: false, reason: 'err.notInShop' };
      const nextIndex = s.levelIndex + 1;
      if (nextIndex >= this.levels.length) {
        this.finishCampaign('miss');
        return { ok: true, ended: true };
      }
      s.shop = null;
      s.levelIndex = nextIndex;
      const nextLevel = this.levels[nextIndex];
      if (nextLevel.month !== s.month) {
        s.month = nextLevel.month;
        s.money -= this.currentRent();
        if (s.money < 0) {
          this.kill('end.rentMonth');
          return { ok: true, ended: true, dead: true };
        }
      }
      this.startLevel();
      return { ok: true, level: this.level };
    }

    finishCampaign(kind) {
      const s = this.state;
      if (kind === 'victory') {
        s.status = 'victory';
        s.phase = 'victory';
      } else {
        s.status = 'no_offer';
        s.phase = 'no_offer';
      }
    }

    kill(reason) {
      const s = this.state;
      s.status = 'dead';
      s.phase = 'dead';
      s.endedReason = reason || 'end.broke';
    }

    restart() {
      this.seed = (Date.now() >>> 0);
      this.rng = createRng(this.seed);
      this.newGame();
    }
  }

  /* ================================================================
   * 8. 导出
   * ================================================================ */
  const VFXEngine = {
    CONFIG: CONFIG,
    DEFAULT_LANG: DEFAULT_LANG,
    LANGS: LANGS,
    I18N: I18N,
    t: t,
    L: L,
    loc: loc,
    PORTS: PORTS,
    PORT_ORDER: PORT_ORDER,
    DEPARTMENTS: DEPARTMENTS,
    NODE_DEFS: NODE_DEFS,
    NODE_TYPES: NODE_TYPES,
    RELICS: RELICS,
    RELIC_IDS: RELIC_IDS,
    RULES: RULES,
    COMPANY_NAMES: COMPANY_NAMES,
    makeRng: makeRng,
    createRng: createRng,
    makeCard: makeCard,
    createCard: makeCard,
    emptyGrid: emptyGrid,
    createEmptyGrid: emptyGrid,
    evaluate: evaluate,
    preview: preview,
    cookBoard: cookBoard,
    explosionChance: explosionChance,
    getRule: getRule,
    generateLevels: generateLevels,
    Game: Game,
    version: '1.1.0'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VFXEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.VFXEngine = VFXEngine;
  } else {
    global.VFXEngine = VFXEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
